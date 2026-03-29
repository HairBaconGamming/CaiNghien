#define MyAppName "CaiNghien Focus Guard"
#define MyAppVersion "0.3.1"
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
CloseApplications=no
CloseApplicationsFilter={#MyAppExeName},{#MyServiceExeName}
RestartApplications=no

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

function CloseRequestPath: string;
begin
  Result := ExpandConstant('{commonappdata}\CaiNghienFocusGuard\installer-close-request.flag');
end;

function CloseDeniedPath: string;
begin
  Result := ExpandConstant('{commonappdata}\CaiNghienFocusGuard\installer-close-denied.flag');
end;

procedure ClearApprovalFile;
begin
  if FileExists(ApprovalFilePath()) then
    DeleteFile(ApprovalFilePath());
end;

procedure ClearCloseRequest;
begin
  if FileExists(CloseRequestPath()) then
    DeleteFile(CloseRequestPath());
end;

procedure ClearCloseDenied;
begin
  if FileExists(CloseDeniedPath()) then
    DeleteFile(CloseDeniedPath());
end;

function CloseWasDenied: Boolean;
begin
  Result := FileExists(CloseDeniedPath());
end;

procedure WriteCloseRequest;
begin
  ForceDirectories(ExpandConstant('{commonappdata}\CaiNghienFocusGuard'));
  SaveStringToFile(CloseRequestPath(), GetDateTimeString('yyyy-mm-dd hh:nn:ss', #0, #0), False);
end;

function ProcessRunning(const ImageName: string): Boolean;
var
  ResultCode: Integer;
begin
  Result := Exec(
    ExpandConstant('{cmd}'),
    '/C tasklist /FI "IMAGENAME eq ' + ImageName + '" | find /I "' + ImageName + '" >nul',
    '',
    SW_HIDE,
    ewWaitUntilTerminated,
    ResultCode
  ) and (ResultCode = 0);
end;

function WaitForProcessExit(const ImageName: string; TimeoutSeconds: Integer): Boolean;
var
  Attempt: Integer;
begin
  for Attempt := 0 to (TimeoutSeconds * 2) do
  begin
    if not ProcessRunning(ImageName) then
    begin
      Result := True;
      exit;
    end;
    Sleep(500);
  end;
  Result := not ProcessRunning(ImageName);
end;

function WaitForServiceStop(TimeoutSeconds: Integer): Boolean;
var
  Attempt: Integer;
begin
  if not ServiceInstalled then
  begin
    Result := True;
    exit;
  end;

  for Attempt := 0 to (TimeoutSeconds * 2) do
  begin
    if not ServiceRunning() then
    begin
      Result := True;
      exit;
    end;
    Sleep(500);
  end;
  Result := not ServiceRunning();
end;

procedure RequestInstalledAppClose;
begin
  ClearCloseRequest();
  ClearCloseDenied();
  WriteCloseRequest();
end;

function ForceStopServiceProcess: Boolean;
var
  ResultCode: Integer;
begin
  Result := Exec(
    ExpandConstant('{cmd}'),
    '/C taskkill /IM "{#MyServiceExeName}" /T /F >nul 2>nul',
    '',
    SW_HIDE,
    ewWaitUntilTerminated,
    ResultCode
  ) and (ResultCode = 0);
end;

function ForceStopAppProcess: Boolean;
var
  ResultCode: Integer;
begin
  Result := Exec(
    ExpandConstant('{cmd}'),
    '/C taskkill /IM "{#MyAppExeName}" /T /F >nul 2>nul',
    '',
    SW_HIDE,
    ewWaitUntilTerminated,
    ResultCode
  ) and (ResultCode = 0);
end;

procedure StopInstalledService;
var
  ResultCode: Integer;
begin
  if not ServiceInstalled then
    exit;
  Exec(
    ExpandConstant('{cmd}'),
    '/C sc stop "{#MyServiceName}" >nul 2>nul',
    '',
    SW_HIDE,
    ewWaitUntilTerminated,
    ResultCode
  );
end;

procedure RestoreServiceIfNeeded(const WasRunning: Boolean);
var
  ResultCode: Integer;
begin
  if not WasRunning then
    exit;
  Exec(
    ExpandConstant('{cmd}'),
    '/C sc start "{#MyServiceName}" >nul 2>nul',
    '',
    SW_HIDE,
    ewWaitUntilTerminated,
    ResultCode
  );
end;

function PrepareToInstall(var NeedsRestart: Boolean): String;
var
  ServiceWasRunning: Boolean;
begin
  Result := '';
  ClearCloseRequest();
  ClearCloseDenied();
  ServiceWasRunning := ServiceRunning();

  StopInstalledService();
  if not WaitForServiceStop(12) then
  begin
    ForceStopServiceProcess();
    if not WaitForProcessExit('{#MyServiceExeName}', 8) then
    begin
      Result := 'Installer không thể dừng service đang chạy. Hãy đóng app và service rồi thử lại.';
      exit;
    end;
  end;

  RequestInstalledAppClose();
  if not WaitForProcessExit('{#MyAppExeName}', 8) then
  begin
    if CloseWasDenied() then
    begin
      RestoreServiceIfNeeded(ServiceWasRunning);
      ClearCloseRequest();
      ClearCloseDenied();
      Result := 'Ứng dụng đang ở strict mode hoặc khóa thủ công nên installer không thể tự đóng nó. Hãy mở app, nhập đúng mật khẩu rồi thử lại.';
      exit;
    end;
    ForceStopAppProcess();
    if not WaitForProcessExit('{#MyAppExeName}', 8) then
    begin
      RestoreServiceIfNeeded(ServiceWasRunning);
      ClearCloseRequest();
      ClearCloseDenied();
      Result := 'Installer không thể đóng ứng dụng đang chạy. Hãy thoát CaiNghien Focus Guard rồi thử lại.';
      exit;
    end;
  end;

  ClearCloseRequest();
  ClearCloseDenied();
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
    ClearCloseRequest();
    ClearCloseDenied();
    if PurgeLocalData then
      DelTree(ExpandConstant('{commonappdata}\CaiNghienFocusGuard'), True, True, True);
  end;
end;
