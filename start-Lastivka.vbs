Set fso = CreateObject("Scripting.FileSystemObject")
folder = fso.GetParentFolderName(WScript.ScriptFullName)

' Use cmd to run PowerShell so that PATH and environment are inherited properly
cmd = "cmd /c cd /d " & Chr(34) & folder & Chr(34) & " && powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File " & Chr(34) & folder & "\run-Lastivka.ps1" & Chr(34)

' 0 = hidden, False = don't wait
CreateObject("Wscript.Shell").Run cmd, 0, False
