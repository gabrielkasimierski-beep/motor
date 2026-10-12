<#
  Crea el proyecto de un cliente nuevo desde la plantilla del Motor
  y deja aislados a todos los clientes entre si.

  Uso (desde cualquier carpeta):
    powershell -ExecutionPolicy Bypass -File C:\Claude\Motor\02-Plantilla-cliente\nuevo-cliente.ps1 -Nombre "Casa Rossi" -Rubro "Gastronomia"
    ... -DesdeProspecto "C:\Claude\Estudio\04-Prospectos\casa-rossi"   (trae el diagnostico del prospecto)
    ... -Carpeta "casa-rossi"                                       (fija el nombre de la carpeta; por defecto sale del nombre)
    ... -SoloAislamiento                                            (regenera los permisos de todos los clientes)

  Resultado: C:\Claude\Clientes\<slug>\ con CLAUDE.md, identidad\, .env.example, .gitignore y
  .claude\settings.json (plugin del Motor activado + permisos que bloquean a los demas clientes).
#>
param(
  [string]$Nombre,
  [string]$Rubro = '{completar}',
  [string]$DesdeProspecto,
  [string]$Carpeta,
  [switch]$SoloAislamiento
)

$ErrorActionPreference = 'Stop'
$Motor    = 'C:\Claude\Motor'
$Clientes = 'C:\Claude\Clientes'
$Base     = Join-Path $Motor '02-Plantilla-cliente\base'
$utf8     = New-Object System.Text.UTF8Encoding($false)

function Get-Slug([string]$s) {
  $t  = $s.ToLowerInvariant().Normalize([Text.NormalizationForm]::FormD)
  $sb = New-Object Text.StringBuilder
  foreach ($c in $t.ToCharArray()) {
    if ([Globalization.CharUnicodeInfo]::GetUnicodeCategory($c) -ne 'NonSpacingMark') { [void]$sb.Append($c) }
  }
  return ($sb.ToString() -replace '[^a-z0-9]+', '-').Trim('-')
}

# "C:/Claude/Estudio" -> "//c/Claude/Estudio" (formato de las reglas de permisos en Windows)
function ConvertTo-RutaRegla([string]$p) {
  $p = $p.Replace('\', '/')
  return '//' + $p.Substring(0, 1).ToLower() + $p.Substring(2)
}

# Cada cliente: no lee ni escribe en los otros clientes ni en las carpetas privadas de cada persona, que se
# declaran en 02-Plantilla-cliente\bloqueos-locales.txt (una ruta por linea; ese archivo NO se versiona).
function Update-Aislamiento {
  $dirs  = @(Get-ChildItem $Clientes -Directory -ErrorAction SilentlyContinue)
  $fijos = @()
  $loc = Join-Path $Motor '02-Plantilla-cliente\bloqueos-locales.txt'
  if (Test-Path $loc) {
    $fijos = @(Get-Content $loc -Encoding UTF8 | ForEach-Object { $_.Trim() } | Where-Object { $_ -and -not $_.StartsWith('#') })
  }
  foreach ($d in $dirs) {
    $bloqueados = @($fijos) + @($dirs | Where-Object { $_.Name -ne $d.Name } | ForEach-Object { 'C:/Claude/Clientes/' + $_.Name })
    $deny = New-Object System.Collections.Generic.List[string]
    foreach ($b in $bloqueados) {
      $r = ConvertTo-RutaRegla $b
      $deny.Add("Read($r/**)")
      $deny.Add("Edit($r/**)")
    }
    $sf = Join-Path $d.FullName '.claude\settings.json'
    if (Test-Path $sf) {
      $cfg = Get-Content $sf -Raw -Encoding UTF8 | ConvertFrom-Json
    } else {
      New-Item -ItemType Directory -Force -Path (Split-Path $sf) | Out-Null
      $cfg = Get-Content (Join-Path $Base '.claude\settings.json') -Raw -Encoding UTF8 | ConvertFrom-Json
    }
    if (-not $cfg.permissions) { $cfg | Add-Member -NotePropertyName permissions -NotePropertyValue ([pscustomobject]@{}) }
    if ($cfg.permissions.PSObject.Properties.Name -contains 'deny') { $cfg.permissions.deny = $deny.ToArray() }
    else { $cfg.permissions | Add-Member -NotePropertyName deny -NotePropertyValue $deny.ToArray() }
    [IO.File]::WriteAllText($sf, ($cfg | ConvertTo-Json -Depth 10), $utf8)
  }
  Write-Output ("Aislamiento actualizado en {0} cliente(s)." -f $dirs.Count)
}

# Busca el CLI de claude: primero en el PATH, si no, el mas nuevo que trae la app de escritorio.
function Find-Claude {
  $c = Get-Command claude -ErrorAction SilentlyContinue
  if ($c) { return $c.Source }
  $root = Join-Path $env:APPDATA 'Claude\claude-code'
  if (Test-Path $root) {
    $f = Get-ChildItem $root -Recurse -Filter claude.exe -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if ($f) { return $f.FullName }
  }
  return $null
}

if ($SoloAislamiento) { Update-Aislamiento; exit 0 }

if (-not $Nombre) { throw 'Falta -Nombre (ej: -Nombre "Casa Rossi").' }
if ($Carpeta) { $slug = Get-Slug $Carpeta } else { $slug = Get-Slug $Nombre }
if (-not $slug) { throw 'El nombre no genera un identificador valido.' }
$dest = Join-Path $Clientes $slug
if (Test-Path $dest) { throw "Ya existe $dest. No se pisa." }

New-Item -ItemType Directory -Force -Path $Clientes | Out-Null
Copy-Item $Base $dest -Recurse -Force
# la plantilla guarda el .gitignore con otro nombre: si no, git lo aplicaria dentro del propio repo del Motor
$gt = Join-Path $dest 'gitignore.plantilla'
if (Test-Path $gt) { Move-Item $gt (Join-Path $dest '.gitignore') -Force }

$fecha = Get-Date -Format 'yyyy-MM-dd'
$plantillas = @(Join-Path $dest 'CLAUDE.md') + @(Get-ChildItem (Join-Path $dest 'identidad') -File | ForEach-Object { $_.FullName })
foreach ($f in $plantillas) {
  $t = [IO.File]::ReadAllText($f, [Text.Encoding]::UTF8)
  $t = $t.Replace('{{CLIENTE}}', $Nombre).Replace('{{RUBRO}}', $Rubro).Replace('{{FECHA}}', $fecha).Replace('{{SLUG}}', $slug)
  [IO.File]::WriteAllText($f, $t, $utf8)
}

if ($DesdeProspecto) {
  if (-not (Test-Path $DesdeProspecto)) { throw "No existe el prospecto: $DesdeProspecto" }
  Copy-Item $DesdeProspecto (Join-Path $dest 'prospecto') -Recurse -Force
}

Update-Aislamiento

# Conecta el plugin del Motor a este cliente (solo a este proyecto).
$manual = 'claude plugin install motor@motor-estudio --scope project'
$claude = Find-Claude
if ($claude) {
  Push-Location $dest
  $prev = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
  $out = & $claude plugin install motor@motor-estudio --scope project 2>&1 | Out-String
  $ErrorActionPreference = $prev
  Pop-Location
  if ($out -match 'Successfully installed') { Write-Output 'Plugin del Motor conectado a este cliente.' }
  else { Write-Output "No pude conectar el plugin solo. En la carpeta del cliente, correr: $manual" }
} else {
  Write-Output "No encontre el CLI de claude. En la carpeta del cliente, correr: $manual"
}

Write-Output ''
Write-Output "Cliente creado: $dest"
Write-Output 'Siguiente paso: abrir Claude Code en esa carpeta y decir "tengo un cliente nuevo".'
Write-Output '(La primera vez, aceptar el aviso de que el proyecto importa el MOTOR.md.)'
