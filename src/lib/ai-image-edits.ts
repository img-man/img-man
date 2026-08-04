// SPDX-License-Identifier: Apache-2.0
import type { AiCapabilityId, AiProviderId } from '@/types/providers';
import { getOrgAiProviderConfig } from './ai-provider-config';
import { getDefaultAiModelForCapability, providerSupportsCapability } from './ai-providers';
import { editOpenAiImage } from './openai';
import {
  getGeminiImageGenModel,
  imagePromptParts,
  parseImageResponse,
} from './vertex-ai';

export interface ApplyAiImageEditInput {
  capability: AiCapabilityId;
  orgId: string;
  imageUrl: string;
  mimeType: string;
  prompt: string;
  maskBase64?: string;
  maskMimeType?: string;
  width?: number;
  height?: number;
}

export interface ApplyAiImageEditResult {
  provider: AiProviderId;
  modelId: string;
  imageData: Buffer;
  mimeType: string;
  textResponse?: string;
}

export async function applyAiImageEdit(
  input: ApplyAiImageEditInput,
): Promise<ApplyAiImageEditResult> {
  const aiProviderConfig = await getOrgAiProviderConfig(input.orgId);
  const provider = providerSupportsCapability(aiProviderConfig.provider, input.capability)
    ? aiProviderConfig.provider
    : 'vertex';
  const modelId =
    getDefaultAiModelForCapability(provider, input.capability)
    || getDefaultAiModelForCapability('vertex', input.capability);

  if (!modelId) {
    throw new Error(`No default model is configured for ${input.capability}`);
  }

  const imageResult = provider === 'openai'
    ? await editOpenAiImage({
      apiKey: aiProviderConfig.openAiApiKey,
      capability: input.capability,
      height: input.height,
      imageUrl: input.imageUrl,
      maskBase64: input.maskBase64,
      maskMimeType: input.maskMimeType,
      mimeType: input.mimeType,
      model: modelId,
      orgId: input.orgId,
      prompt: input.prompt,
      width: input.width,
    })
    : parseImageResponse(
      await (await getGeminiImageGenModel(input.orgId, modelId)).generateContent({
        contents: [
          {
            role: 'user',
            parts: input.maskBase64
              ? [
                {
                  fileData: {
                    fileUri: input.imageUrl,
                    mimeType: input.mimeType,
                  },
                },
                {
                  inlineData: {
                    data: input.maskBase64,
                    mimeType: input.maskMimeType || 'image/png',
                  },
                },
                {
                  text: input.prompt,
                },
              ]
              : imagePromptParts(input.imageUrl, input.mimeType, input.prompt),
          },
        ],
      }),
    );

  if (!imageResult) {
    throw new Error('AI did not return an image result');
  }

  return {
    provider,
    modelId,
    ...imageResult,
  };
}