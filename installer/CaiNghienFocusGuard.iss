#define MyAppName "CaiNghien Focus Guard"
#define MyAppVersion "0.2.0"
#define MyAppPublisher "CaiNghien Project"
#define MyAppExeName "CaiNghienFocusGuard.exe"
#define MyServiceExeName "CaiNghienFocusGuardService.exe"
#define MyServiceName "CaiNghienFocusGuardService"

#ifndef SourceExe
  #define SourceExe "..\dist\CaiNghienFocusGuard.exe"
#endif

#ifndef SourceServiceExe
  #define SourceServiceExe "..\dist\CaiNghienFocusGuardService.exe"
#endif

#ifndef OutputFileName
  #define OutputFileName "CaiNghienFocusGuard-Setup"
#endif

[Setup]
AppId={{9E3BA354-7E6C-4D1F-A9F2-514022D0CA1A}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
PrivilegesRequired=admin
ArchitecturesInstallIn64BitMode=x64compatible
OutputDir=..\dist\installer
OutputBaseFilename={#OutputFileName}
SetupIconFile=..\assets\CaiNghienFocusGuard.ico
UninstallDisplayIcon={app}\{#MyAppExeName}
WizardStyle=modern
Compression=lzma2/ultra64
SolidCompression=yes
ChangesAssociations=no

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "Tao shortcut ngoai Desktop"; GroupDescription: "Tuy chon bo sung:"

[Dirs]
Name: "{commonappdata}\CaiNghienFocusGuard"; Permissions: users-modify

[Files]
Source: "{#SourceExe}"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#SourceServiceExe}"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\README.md"; DestDir: "{app}"; DestName: "README.txt"; Flags: ignoreversion

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyServiceExeName}"; Parameters: "install --startup auto"; Flags: runhidden waituntilterminated; Check: not ServiceInstalled
Filename: "{app}\{#MyServiceExeName}"; Parameters: "start"; Flags: runhidden waituntilterminated; Check: not ServiceRunning
Filename: "{app}\{#MyAppExeName}"; Parameters: "--startup"; Description: "Mo {#MyAppName}"; Flags: nowait postinstall skipifsilent

[UninstallRun]
Filename: "{app}\{#MyServiceExeName}"; Parameters: "stop"; Flags: runhidden waituntilterminated skipifdoesntexist; RunOnceId: "StopFocusGuardService"
Filename: "{app}\{#MyServiceExeName}"; Parameters: "remove"; Flags: runhidden waituntilterminated skipifdoesntexist; RunOnceId: "RemoveFocusGuardService"

[Code]
var
  PurgeLocalData: Boolean;

function RunScQuery(const Query: string): Boolean;
var
  ResultCode: Integer;
begin
  Result := Exec(
    ExpandConstant('{cmd}'),
    '/C sc query "' + Query + '" >nul 2>nul',
    '',
    SW_HIDE,
    ewWaitUntilTerminated,
    ResultCode
  ) and (ResultCode = 0);
end;

function ServiceInstalled: Boolean;
begin
  Result := RunScQuery('{#MyServiceName}');
end;

function ServiceRunning: Boolean;
var
  ResultCode: Integer;
begin
  Result := Exec(
    ExpandConstant('{cmd}'),
    '/C sc query "' + '{#MyServiceName}' + '" | find "RUNNING" >nul',
    '',
    SW_HIDE,
    ewWaitUntilTerminated,
    ResultCode
  ) and (ResultCode = 0);
end;

function ApprovalFilePath: string;
begin
  Result := ExpandConstant('{commonappdata}\CaiNghienFocusGuard\uninstall-approval.ini');
end;

procedure ClearApprovalFile;
begin
  if FileExists(ApprovalFilePath()) then
    DeleteFile(ApprovalFilePath());
end;

function ApprovalStillValid: Boolean;
var
  ExpireStamp: string;
  NowStamp: string;
begin
  if not FileExists(ApprovalFilePath()) then
  begin
    Result := False;
    exit;
  end;
  ExpireStamp := GetIniString('approval', 'expires_stamp', '', ApprovalFilePath());
  if ExpireStamp = '' then
  begin
    Result := False;
    exit;
  end;
  NowStamp := GetDateTimeString('yyyymmddhhnnss', #0, #0);
  Result := ExpireStamp >= NowStamp;
end;

procedure LoadApprovalSettings;
var
  PurgeValue: string;
begin
  PurgeValue := GetIniString('approval', 'purge_data', '0', ApprovalFilePath());
  PurgeLocalData := PurgeValue = '1';
  ClearApprovalFile();
end;

function LaunchUninstallGuard: Boolean;
var
  ResultCode: Integer;
begin
  Result := Exec(
    ExpandConstant('{app}\{#MyAppExeName}'),
    '--prepare-uninstall',
    '',
    SW_SHOWNORMAL,
    ewWaitUntilTerminated,
    ResultCode
  ) and (ResultCode = 0);
end;

function InitializeUninstall: Boolean;
begin
  PurgeLocalData := False;
  if ApprovalStillValid then
  begin
    LoadApprovalSettings();
    Result := True;
    exit;
  end;

  if not LaunchUninstallGuard then
  begin
    Result := False;
    exit;
  end;

  if ApprovalStillValid then
  begin
    LoadApprovalSettings();
    Result := True;
    exit;
  end;

  Result := False;
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
begin
  if CurUninstallStep = usPostUninstall then
  begin
    RegDeleteValue(HKCU, 'Software\Microsoft\Windows\CurrentVersion\Run', 'CaiNghienFocusGuard');
    ClearApprovalFile();
    if PurgeLocalData then
      DelTree(ExpandConstant('{commonappdata}\CaiNghienFocusGuard'), True, True, True);
  end;
end;
