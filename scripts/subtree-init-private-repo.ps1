param(
    [Parameter(Mandatory = $true)]
    [string]$PrivateRemote,
    [string]$PublicRemote = 'https://github.com/img-man/img-man.git',
    [string]$Branch = 'main'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Write-Log {
    param([string]$Message)
    Write-Host "[subtree-init] $Message"
}

$workdir = Join-Path ([System.IO.Path]::GetTempPath()) ("img-man-private-init-" + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $workdir | Out-Null

try {
    Write-Log "Cloning private repo into $workdir"
    git clone $PrivateRemote (Join-Path $workdir 'private-repo') | Out-Null
    Push-Location (Join-Path $workdir 'private-repo')

    git remote add public $PublicRemote
    git fetch public $Branch
    git subtree add --prefix=upstream/img-man public $Branch --squash -m "chore: seed public img-man core at upstream/img-man $(Get-Date -Format s)Z"

    $paths = @(
        'apps/landing',
        'apps/cloud-console',
        'apps/white-label-demo',
        'packages/imageman-whitelabel',
        'packages/imageman-cloud-support',
        'packages/premium-templates',
        'overlays/imageman-service',
        'scripts'
    )

    foreach ($path in $paths) {
        New-Item -ItemType Directory -Force -Path $path | Out-Null
    }

    @'
# Private overlay

- Do not edit upstream/img-man directly.
- Shared fixes go upstream first.
- Put private overrides in overlays/imageman-service/.
'@ | Set-Content -Path 'overlays/imageman-service/README.md'

    @'
Set-StrictMode -Version Latest
$ErrorActionPreference = ''Stop''
git fetch public main
git subtree pull --prefix=upstream/img-man public main --squash -m "chore: sync public core $(Get-Date -Format s)Z"
'@ | Set-Content -Path 'scripts/sync-public.ps1'

    git add apps packages overlays scripts
    git commit -m "chore: scaffold private wrapper around public img-man"
    git push origin HEAD
}
finally {
    Pop-Location -ErrorAction SilentlyContinue
    Remove-Item -Recurse -Force $workdir
}
