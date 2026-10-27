# Free local text-to-speech (Windows SAPI voice installed with Windows; no online service, no cost).  usage: powershell -File tts.ps1 <lines.json> <outDir> [voice]
param([string]$Lines, [string]$OutDir, [string]$Voice = "Microsoft Zira Desktop")
Add-Type -AssemblyName System.Speech
$items = Get-Content -Raw -Path $Lines | ConvertFrom-Json
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
foreach ($it in $items) {
  $s = New-Object System.Speech.Synthesis.SpeechSynthesizer
  $s.SelectVoice($Voice); $s.Rate = 0; $s.Volume = 100
  $fmt = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(44100, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)
  $s.SetOutputToWaveFile((Join-Path $OutDir ($it.id + ".wav")), $fmt)
  $s.Speak($it.text)
  $s.Dispose()
}
Write-Output ("spoke " + $items.Count + " lines with " + $Voice)
