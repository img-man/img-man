// SPDX-License-Identifier: Apache-2.0
import {
  assertAiProviderCapability,
  getDefaultAiModelForCapability,
} from './ai-providers';
import type { AiCapabilityId } from '@/types/providers';
import type { AiImageResult } from './vertex-ai';

type OpenAiChatContentPart = {
  type?: string;
  text?: string;
  image_url?: {
    url: string;
    detail?: 'auto' | 'low' | 'high';
  };
};

type OpenAiChatResponse = {
  choices?: Array<{
    message?: {
      content?: string | OpenAiChatContentPart[];
    };
  }>;
  error?: {
    message?: string;
  };
};

type OpenAiImageResponse = {
  data?: Array<{
    b64_json?: string;
    revised_prompt?: string;
    url?: string;
  }>;
  error?: {
    message?: string;
  };
};

type OpenAiTextOptions = {
  prompt: string;
  systemPrompt?: string;
  model?: string;
  apiKey?: string;
  orgId?: string;
};

type OpenAiVisionTextOptions = {
  prompt: string;
  imageUrl?: string;
  imageUrls?: string[];
  model?: string;
  apiKey?: string;
  orgId?: string;
};

type OpenAiImageOptions = {
  prompt: string;
  width: number;
  height: number;
  model?: string;
  apiKey?: string;
  orgId?: string;
};

type OpenAiImageEditOptions = {
  prompt: string;
  imageUrl: string;
  mimeType: string;
  capability: AiCapabilityId;
  maskBase64?: string;
  maskMimeType?: string;
  model?: string;
  apiKey?: string;
  orgId?: string;
  width?: number;
  height?: number;
};

function resolveOpenAiApiKey(apiKey?: string, orgId?: string) {
  const resolvedApiKey = apiKey?.trim() || process.env.OPENAI_API_KEY?.trim();

  if (!resolvedApiKey) {
    throw new Error(
      orgId
        ? `OpenAI is selected for org "${orgId}" but no OpenAI API key is configured.`
        : 'OpenAI is selected but no OpenAI API key is configured.',
    );
  }

  return resolvedApiKey;
}

function getOpenAiErrorMessage(payload: { error?: { message?: string } } | null) {
  return payload?.error?.message?.trim() || 'Unknown OpenAI API error';
}

function parseOpenAiTextContent(content?: string | OpenAiChatContentPart[]) {
  if (!content) {
    return undefined;
  }

  if (typeof content === 'string') {
    return content.trim();
  }

  return content
    .filter((part) => part.type === 'text' && typeof part.text === 'string')
    .map((part) => part.text?.trim() || '')
    .filter(Boolean)
    .join('\n')
    .trim();
}

function normalizeOpenAiImageSize(width: number, height: number) {
  if (width >= height * 1.2) {
    return '1536x1024';
  }

  if (height >= width * 1.2) {
    return '1024x1536';
  }

  return '1024x1024';
}

async function downloadOpenAiBinary(url: string, failureMessage: string) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`${failureMessage} (${response.status})`);
  }

  return Buffer.from(await response.arrayBuffer());
}

export async function generateOpenAiText({
  prompt,
  systemPrompt,
  model,
  apiKey,
  orgId,
}: OpenAiTextOptions) {
  assertAiProviderCapability('openai', 'text.generate');

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resolveOpenAiApiKey(apiKey, orgId)}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model:
        model
        || getDefaultAiModelForCapability('openai', 'text.generate')
        || 'gpt-4.1-mini',
      messages: [
        ...(systemPrompt
          ? [{ role: 'system', content: systemPrompt }]
          : []),
        { role: 'user', content: prompt },
      ],
      temperature: 0.4,
    }),
  });

  const payload = (await response.json().catch(() => null)) as OpenAiChatResponse | null;

  if (!response.ok) {
    throw new Error(
      `OpenAI text generation error (${response.status}): ${getOpenAiErrorMessage(payload)}`,
    );
  }

  const content = parseOpenAiTextContent(payload?.choices?.[0]?.message?.content);

  if (!content) {
    throw new Error('OpenAI returned no text output');
  }

  return content;
}

export async function generateOpenAiVisionText({
  prompt,
  imageUrl,
  imageUrls,
  model,
  apiKey,
  orgId,
}: OpenAiVisionTextOptions) {
  assertAiProviderCapability('openai', 'vision.tag');

  const resolvedImageUrls = imageUrls?.length
    ? imageUrls
    : imageUrl
      ? [imageUrl]
      : [];

  if (!resolvedImageUrls.length) {
    throw new Error('OpenAI vision analysis requires at least one image URL');
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resolveOpenAiApiKey(apiKey, orgId)}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model:
        model
        || getDefaultAiModelForCapability('openai', 'vision.tag')
        || 'gpt-4.1-mini',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            ...resolvedImageUrls.map((url) => ({
              type: 'image_url' as const,
              image_url: {
                url,
                detail: 'auto' as const,
              },
            })),
          ],
        },
      ],
      temperature: 0.2,
    }),
  });

  const payload = (await response.json().catch(() => null)) as OpenAiChatResponse | null;

  if (!response.ok) {
    throw new Error(
      `OpenAI vision analysis error (${response.status}): ${getOpenAiErrorMessage(payload)}`,
    );
  }

  const content = parseOpenAiTextContent(payload?.choices?.[0]?.message?.content);

  if (!content) {
    throw new Error('OpenAI returned no vision analysis output');
  }

  return content;
}

export async function generateOpenAiImage({
  prompt,
  width,
  height,
  model,
  apiKey,
  orgId,
}: OpenAiImageOptions): Promise<AiImageResult> {
  assertAiProviderCapability('openai', 'image.generate');

  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resolveOpenAiApiKey(apiKey, orgId)}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model:
        model
        || getDefaultAiModelForCapability('openai', 'image.generate')
        || 'gpt-image-1',
      prompt,
      size: normalizeOpenAiImageSize(width, height),
    }),
  });

  const payload = (await response.json().catch(() => null)) as OpenAiImageResponse | null;

  if (!response.ok) {
    throw new Error(
      `OpenAI image generation error (${response.status}): ${getOpenAiErrorMessage(payload)}`,
    );
  }

  const image = payload?.data?.[0];

  if (image?.b64_json) {
    return {
      imageData: Buffer.from(image.b64_json, 'base64'),
      mimeType: 'image/png',
      textResponse: image.revised_prompt,
    };
  }

  if (image?.url) {
    return {
      imageData: await downloadOpenAiBinary(image.url, 'Failed to download generated OpenAI image'),
      mimeType: 'image/png',
      textResponse: image.revised_prompt,
    };
  }

  throw new Error('OpenAI did not generate an image');
}

export async function editOpenAiImage({
  prompt,
  imageUrl,
  mimeType,
  capability,
  maskBase64,
  maskMimeType,
  model,
  apiKey,
  orgId,
  width,
  height,
}: OpenAiImageEditOptions): Promise<AiImageResult> {
  assertAiProviderCapability('openai', capability);

  const sourceImage = await downloadOpenAiBinary(
    imageUrl,
    'Failed to download source image for OpenAI edit',
  );
  const formData = new FormData();

  formData.append(
    'model',
    model || getDefaultAiModelForCapability('openai', capability) || 'gpt-image-1',
  );
  formData.append('prompt', prompt);
  formData.append(
    'image',
    new Blob([sourceImage], { type: mimeType }),
    'source-image',
  );

  if (maskBase64) {
    formData.append(
      'mask',
      new Blob([Buffer.from(maskBase64, 'base64')], {
        type: maskMimeType || 'image/png',
      }),
      'mask-image',
    );
  }

  formData.append('response_format', 'b64_json');

  if (width && height) {
    formData.append('size', normalizeOpenAiImageSize(width, height));
  }

  const response = await fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resolveOpenAiApiKey(apiKey, orgId)}`,
    },
    body: formData,
  });

  const payload = (await response.json().catch(() => null)) as OpenAiImageResponse | null;

  if (!response.ok) {
    throw new Error(
      `OpenAI image edit error (${response.status}): ${getOpenAiErrorMessage(payload)}`,
    );
  }

  const image = payload?.data?.[0];

  if (image?.b64_json) {
    return {
      imageData: Buffer.from(image.b64_json, 'base64'),
      mimeType: 'image/png',
      textResponse: image.revised_prompt,
    };
  }

  if (image?.url) {
    return {
      imageData: await downloadOpenAiBinary(image.url, 'Failed to download edited OpenAI image'),
      mimeType: 'image/png',
      textResponse: image.revised_prompt,
    };
  }

  throw new Error('OpenAI did not return an edited image');
}