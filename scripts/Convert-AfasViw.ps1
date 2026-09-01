param(
  [Parameter(Mandatory = $true)]
  [string]$SourcePath,

  [Parameter(Mandatory = $true)]
  [ValidateRange(1, 10)]
  [int]$TargetNumber,

  [Parameter(Mandatory = $true)]
  [string]$OutputPath
)

$ErrorActionPreference = "Stop"

function Find-Bytes {
  param(
    [byte[]]$Data,
    [byte[]]$Pattern,
    [int]$StartAt = 0
  )

  for ($index = $StartAt; $index -le $Data.Length - $Pattern.Length; $index++) {
    $matches = $true
    for ($offset = 0; $offset -lt $Pattern.Length; $offset++) {
      if ($Data[$index + $offset] -ne $Pattern[$offset]) {
        $matches = $false
        break
      }
    }
    if ($matches) { return $index }
  }

  return -1
}

function Replace-FixedBytes {
  param(
    [byte[]]$Data,
    [byte[]]$Search,
    [byte[]]$Replacement
  )

  if ($Search.Length -ne $Replacement.Length) {
    throw "Vaste bytevervanging vereist gelijke lengtes."
  }

  $count = 0
  for ($index = 0; $index -le $Data.Length - $Search.Length; $index++) {
    $matches = $true
    for ($offset = 0; $offset -lt $Search.Length; $offset++) {
      if ($Data[$index + $offset] -ne $Search[$offset]) {
        $matches = $false
        break
      }
    }
    if (-not $matches) { continue }

    [Array]::Copy($Replacement, 0, $Data, $index, $Replacement.Length)
    $count++
    $index += $Search.Length - 1
  }

  return $count
}

function Replace-AllBytes {
  param(
    [byte[]]$Data,
    [byte[]]$Search,
    [byte[]]$Replacement
  )

  $result = [IO.MemoryStream]::new()
  $count = 0
  $index = 0

  while ($index -lt $Data.Length) {
    $foundAt = Find-Bytes -Data $Data -Pattern $Search -StartAt $index
    if ($foundAt -lt 0) {
      $result.Write($Data, $index, $Data.Length - $index)
      break
    }

    if ($foundAt -gt $index) {
      $result.Write($Data, $index, $foundAt - $index)
    }
    $result.Write($Replacement, 0, $Replacement.Length)
    $count++
    $index = $foundAt + $Search.Length
  }

  $newData = $result.ToArray()
  $result.Dispose()
  return [pscustomobject]@{ Data = $newData; Count = $count }
}

function New-SerializedString {
  param([string]$Value)

  $utf8 = [Text.UTF8Encoding]::new($false)
  $valueBytes = $utf8.GetBytes($Value)
  if ($valueBytes.Length -ge 128) {
    throw "De tabelomschrijving is te lang voor dit VIW-formaat."
  }

  $bytes = [Collections.Generic.List[byte]]::new()
  $bytes.Add(0x09)
  $bytes.Add([byte]$valueBytes.Length)
  $bytes.AddRange($valueBytes)
  return [byte[]]$bytes.ToArray()
}

function Replace-LocalizedTableNames {
  param(
    [byte[]]$Data,
    [int]$Number
  )

  # Dit zijn exact de 11 gelokaliseerde tabelnamen in het originele AFAS-bestand.
  # Exact zoeken voorkomt dat willekeurige binaire 0x09-bytes als string worden gezien.
  $sourceNames = @(
    "Vrij bestand 9",
    "Freie Datei 9",
    "Fichier libre 9",
    "Custom file 9",
    "Archivo personalizado 9",
    "File personalizzato 9",
    "Plik wlasny 9",
    "Archivo personalisá 9",
    "Ficheiro personalizado 9"
  )

  $current = $Data
  $replacements = 0
  foreach ($sourceName in $sourceNames) {
    $targetName = $sourceName -replace ' 9$', " $Number"
    $replacement = Replace-AllBytes `
      -Data $current `
      -Search (New-SerializedString -Value $sourceName) `
      -Replacement (New-SerializedString -Value $targetName)
    $current = [byte[]]$replacement.Data
    $replacements += [int]$replacement.Count
  }

  return [pscustomobject]@{ Data = $current; Count = $replacements }
}

$source = [IO.File]::ReadAllBytes($SourcePath)
$localHeader = [byte[]](0x50, 0x4B, 0x03, 0x04)
$centralHeader = [byte[]](0x50, 0x4B, 0x01, 0x02)
$endHeader = [byte[]](0x50, 0x4B, 0x05, 0x06)

$zipStart = Find-Bytes -Data $source -Pattern $localHeader
$centralStart = Find-Bytes -Data $source -Pattern $centralHeader -StartAt $zipStart
$endStart = Find-Bytes -Data $source -Pattern $endHeader -StartAt $centralStart
if ($zipStart -lt 12 -or $centralStart -lt 0 -or $endStart -lt 0) {
  throw "Dit bestand heeft niet de verwachte AFAS VIW-structuur."
}

$commentLength = [BitConverter]::ToUInt16($source, $endStart + 20)
$zipEnd = $endStart + 22 + $commentLength
$zipBytes = [byte[]]$source[$zipStart..($zipEnd - 1)]

$zipStream = [IO.MemoryStream]::new($zipBytes, $false)
$archive = [IO.Compression.ZipArchive]::new($zipStream, [IO.Compression.ZipArchiveMode]::Read)
$externalEntry = $archive.GetEntry("ExternalData")
if (-not $externalEntry) { throw "ExternalData ontbreekt in dit VIW-bestand." }
$reader = [IO.StreamReader]::new($externalEntry.Open(), [Text.Encoding]::UTF8)
$base64 = $reader.ReadToEnd()
$reader.Dispose()
$archive.Dispose()
$zipStream.Dispose()

$payload = [Convert]::FromBase64String($base64)
$localizedResult = Replace-LocalizedTableNames -Data $payload -Number $TargetNumber
$payload = [byte[]]$localizedResult.Data
$localizedCount = [int]$localizedResult.Count

$ascii = [Text.Encoding]::ASCII
$sourceTable = $ascii.GetBytes("K09")
$targetTable = $ascii.GetBytes(("K{0:D2}" -f $TargetNumber))
$tableCount = Replace-FixedBytes -Data $payload -Search $sourceTable -Replacement $targetTable

if ($TargetNumber -ne 9 -and ($localizedCount -lt 11 -or $tableCount -lt 10)) {
  throw "Niet alle verwijzingen naar Vrij bestand 09 konden veilig worden aangepast."
}

$newBase64 = $ascii.GetBytes([Convert]::ToBase64String($payload))
$newZipStream = [IO.MemoryStream]::new()
$newArchive = [IO.Compression.ZipArchive]::new($newZipStream, [IO.Compression.ZipArchiveMode]::Create, $true)
$newEntry = $newArchive.CreateEntry("ExternalData", [IO.Compression.CompressionLevel]::Optimal)
$entryStream = $newEntry.Open()
$entryStream.Write($newBase64, 0, $newBase64.Length)
$entryStream.Dispose()
$newArchive.Dispose()
$newZip = $newZipStream.ToArray()
$newZipStream.Dispose()

$prefix = [byte[]]$source[0..($zipStart - 9)]
$zipLength = [BitConverter]::GetBytes([int64]$newZip.Length)
$trailer = if ($zipEnd -lt $source.Length) { [byte[]]$source[$zipEnd..($source.Length - 1)] } else { [byte[]]@() }

$output = [IO.MemoryStream]::new()
$output.Write($prefix, 0, $prefix.Length)
$output.Write($zipLength, 0, $zipLength.Length)
$output.Write($newZip, 0, $newZip.Length)
if ($trailer.Length) { $output.Write($trailer, 0, $trailer.Length) }

$resolvedOutput = [IO.Path]::GetFullPath($OutputPath)
$outputDirectory = [IO.Path]::GetDirectoryName($resolvedOutput)
if (-not [IO.Directory]::Exists($outputDirectory)) {
  [IO.Directory]::CreateDirectory($outputDirectory) | Out-Null
}
[IO.File]::WriteAllBytes($resolvedOutput, $output.ToArray())
$output.Dispose()

Write-Output "Gegenereerd: $resolvedOutput"
Write-Output "Tabelverwijzingen aangepast: $tableCount"
Write-Output "Tabelomschrijvingen aangepast: $localizedCount"
