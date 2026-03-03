; Inno Setup script for Lastivka installer (wizard like Telegram)
; To build:
; 1. Install Inno Setup: https://jrsoftware.org/isinfo.php
; 2. Open this file in Inno Setup Compiler
; 3. Press Build -> Compile (F9)
; Result: LastivkaSetup.exe with language and path selection

[Setup]
AppId={{5B8F6F1F-Lastivka-1.0.0}}
AppName=Ластівка
AppVersion=1.0.0
AppPublisher=Lastivka
DefaultDirName={autopf}\Lastivka
DefaultGroupName=Ластівка
DisableDirPage=no
DisableProgramGroupPage=no
; Іконка інсталятора та ярликів. Якщо файлу немає — закоментуйте наступний рядок.
; SetupIconFile=logo\LastiVka.ico
OutputDir=.
OutputBaseFilename=LastivkaSetup
Compression=lzma
SolidCompression=yes
WizardStyle=modern

[Languages]
Name: "ukrainian"; MessagesFile: "compiler:Languages\Ukrainian.isl"
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[Files]
; Copy the whole project into the chosen folder (includes neon-db.txt for shared database)
Source: "*"; DestDir: "{app}"; Flags: recursesubdirs createallsubdirs ignoreversion
Source: "node_modules\*"; DestDir: "{app}\node_modules"; Flags: recursesubdirs createallsubdirs ignoreversion skipifsourcedoesntexist
Source: "server\node_modules\*"; DestDir: "{app}\server\node_modules"; Flags: recursesubdirs createallsubdirs ignoreversion skipifsourcedoesntexist

[Icons]
; Для круглої іконки: конвертуйте logo\LastiVka-round.svg в logo\LastiVka.ico і розкоментуйте IconFilename нижче
Name: "{group}\Ластівка"; Filename: "{sys}\wscript.exe"; Parameters: """{app}\start-Lastivka.vbs"""; WorkingDir: "{app}"
Name: "{group}\Ластівка (діагностика)"; Filename: "{app}\Start-Lastivka-debug.bat"; WorkingDir: "{app}"; Comment: "Запуск з вікном помилок, якщо ярлик не працює"
Name: "{group}\Видалити Ластівку"; Filename: "{uninstallexe}"
Name: "{commondesktop}\Ластівка"; Filename: "{sys}\wscript.exe"; Parameters: """{app}\start-Lastivka.vbs"""; WorkingDir: "{app}"; Tasks: desktopicon

[Run]
; Запустити інсталятор залежностей відразу після встановлення (необов'язково)
Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; \
  Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\install-Lastivka.ps1"""; \
  WorkingDir: "{app}"; Flags: nowait postinstall shellexec skipifsilent

