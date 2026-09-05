$ErrorActionPreference = "Stop"

$repositoryUrl = if ($env:OPENMONETIS_REPOSITORY_URL) {
    $env:OPENMONETIS_REPOSITORY_URL
} else {
    "https://github.com/felipegcoutinho/openmonetis-v2.git"
}
$installDirectory = if ($env:OPENMONETIS_INSTALL_DIR) {
    [System.IO.Path]::GetFullPath($env:OPENMONETIS_INSTALL_DIR)
} else {
    Join-Path (Get-Location) "openmonetis"
}
$publicUrl = if ($env:OPENMONETIS_URL) {
    $env:OPENMONETIS_URL
} else {
    "http://localhost:7002"
}

function Assert-Command {
    param([Parameter(Mandatory = $true)][string]$Name)

    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "$Name is required."
    }
}

function Assert-LastCommandSucceeded {
    param([Parameter(Mandatory = $true)][string]$Operation)

    if ($LASTEXITCODE -ne 0) {
        throw "$Operation failed with exit code $LASTEXITCODE."
    }
}

function New-RandomSecret {
    $bytes = New-Object byte[] 32
    $generator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try {
        $generator.GetBytes($bytes)
    } finally {
        $generator.Dispose()
    }

    return -join ($bytes | ForEach-Object { $_.ToString("x2") })
}

function Set-EnvironmentValue {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$Key,
        [Parameter(Mandatory = $true)][string]$Value
    )

    $lines = [System.Collections.Generic.List[string]]::new()
    $lines.AddRange([string[]][System.IO.File]::ReadAllLines($Path))
    $updated = $false

    for ($index = 0; $index -lt $lines.Count; $index++) {
        if ($lines[$index].StartsWith("$Key=")) {
            $lines[$index] = "$Key=$Value"
            $updated = $true
            break
        }
    }

    if (-not $updated) {
        $lines.Add("$Key=$Value")
    }

    [System.IO.File]::WriteAllLines($Path, $lines, [System.Text.UTF8Encoding]::new($false))
}

Assert-Command "git"
Assert-Command "docker"

& docker compose version *> $null
Assert-LastCommandSucceeded "Docker Compose validation"
& docker info *> $null
Assert-LastCommandSucceeded "Docker daemon validation"

if (Test-Path $installDirectory) {
    throw "$installDirectory already exists. Choose another location with OPENMONETIS_INSTALL_DIR."
}

Write-Host "Cloning OpenMonetis into $installDirectory..."
& git clone --depth 1 $repositoryUrl $installDirectory
Assert-LastCommandSucceeded "Repository clone"

$environmentFile = Join-Path $installDirectory ".env"
Copy-Item (Join-Path $installDirectory ".env.example") $environmentFile

$databasePassword = New-RandomSecret
Set-EnvironmentValue $environmentFile "POSTGRES_PASSWORD" $databasePassword
Set-EnvironmentValue $environmentFile "DATABASE_URL" "postgres://postgres:$databasePassword@localhost:7000/openmonetis"
Set-EnvironmentValue $environmentFile "BETTER_AUTH_SECRET" (New-RandomSecret)
Set-EnvironmentValue $environmentFile "DEVICE_TOKEN_SECRET" (New-RandomSecret)
Set-EnvironmentValue $environmentFile "PERSON_CONNECTION_SECRET" (New-RandomSecret)
Set-EnvironmentValue $environmentFile "OPENMONETIS_URL" $publicUrl
Set-EnvironmentValue $environmentFile "BETTER_AUTH_URL" $publicUrl
Set-EnvironmentValue $environmentFile "WEB_URL" $publicUrl
Set-EnvironmentValue $environmentFile "CORS_ORIGIN" $publicUrl

Write-Host "Pulling images and starting OpenMonetis..."
Push-Location $installDirectory
try {
    & docker compose pull
    Assert-LastCommandSucceeded "Image pull"
    & docker compose up -d
    Assert-LastCommandSucceeded "Application startup"
    & docker compose ps
    Assert-LastCommandSucceeded "Application status check"
} finally {
    Pop-Location
}

Write-Host ""
Write-Host "OpenMonetis is ready at $publicUrl"
Write-Host "Installation directory: $installDirectory"
