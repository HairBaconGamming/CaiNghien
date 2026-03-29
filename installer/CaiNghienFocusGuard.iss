#define MyAppName "CaiNghien Focus Guard"
#define MyAppVersion "0.3.6"
#define MyAppPublisher "CaiNghien Project"
#define MyAppExeName "CaiNghienFocusGuard.exe"
#define MyServiceExeName "CaiNghienFocusGuardService.exe"
#define MyServiceName "CaiNghienFocusGuardService"

#ifndef SourceAppDir
  #define SourceAppDir "..\dist\CaiNghienFocusGuardBundle"
#endif

#ifndef OutputFileName
  #define OutputFileName "CaiNghienFocusGuard-Setup"
#endif

[Setup]
AppId={{9E3BA354-7E6C-4D1F-A9F2-514022D0CA1A}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={localappdata}\Programs\{#MyAppName}
DefaultGroupName={#MyAppName}
UsePreviousAppDir=yes
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=dialog
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
UsedUserAreasWarning=no

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "Tạo shortcut ngoài Desktop"; GroupDescription: "Tùy chọn bổ sung:"

[Files]
Source: "{#SourceAppDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "{#SourceAppDir}\*"; DestDir: "{code:SharedServiceBundleDir}"; Flags: ignoreversion recursesubdirs createallsubdirs; Check: ShouldInstallSharedServiceBundle
Source: "..\README.md"; DestDir: "{app}"; DestName: "README.txt"; Flags: ignoreversion

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
Filename: "{cmd}"; Parameters: "/C ping 127.0.0.1 -n 2 >nul && start """" /D ""{app}"" ""{app}\{#MyAppExeName}"""; Description: "Mở {#MyAppName}"; Flags: nowait postinstall runhidden skipifsilent

[UninstallRun]
Filename: "{app}\{#MyServiceExeName}"; Parameters: "stop"; Flags: runhidden waituntilterminated skipifdoesntexist; RunOnceId: "StopFocusGuardService"; Check: CanManageServiceAtUninstall
Filename: "{app}\{#MyServiceExeName}"; Parameters: "remove"; Flags: runhidden waituntilterminated skipifdoesntexist; RunOnceId: "RemoveFocusGuardService"; Check: CanManageServiceAtUninstall

[Code]
var
  PurgeLocalData: Boolean;
  ExistingInstallDetected: Boolean;
  RepairMode: Boolean;
  ServiceInstalledBeforeInstall: Boolean;
  InstallModePage: TWizardPage;
  UpdateModeRadio: TRadioButton;
  RepairModeRadio: TRadioButton;

function UserAppDataRoot: string; forward;
function SharedAppDataRoot: string; forward;
function SharedModeMarkerPath: string; forward;
function SharedServiceBundleDir(Param: string): string; forward;
function ServiceInstalled: Boolean; forward;

function AppInstallDir: string;
begin
  Result := ExpandConstant('{app}');
end;

function MainAppExePath: string;
begin
  Result := AppInstallDir() + '\{#MyAppExeName}';
end;

function ServiceExePath: string;
begin
  Result := AppInstallDir() + '\{#MyServiceExeName}';
end;

function AppDataRoot: string;
begin
  if FileExists(SharedModeMarkerPath()) or ServiceInstalled() then
    Result := SharedAppDataRoot()
  else
    Result := UserAppDataRoot();
end;

function UserAppDataRoot: string;
begin
  Result := ExpandConstant('{userappdata}\CaiNghienFocusGuard');
end;

function SharedAppDataRoot: string;
begin
  Result := ExpandConstant('{commonappdata}\CaiNghienFocusGuard');
end;

function SharedModeMarkerPath: string;
begin
  Result := SharedAppDataRoot() + '\service-mode.json';
end;

function SharedServiceBundleDir(Param: string): string;
begin
  Result := SharedAppDataRoot() + '\service-bundle';
end;

function SharedServiceExePath: string;
begin
  Result := SharedServiceBundleDir('') + '\{#MyServiceExeName}';
end;

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

function TryGetInstalledVersion(var VersionText: string): Boolean;
begin
  VersionText := '';
  Result := FileExists(MainAppExePath()) and GetVersionNumbersString(MainAppExePath(), VersionText);
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

function CanManageServiceAtUninstall: Boolean;
begin
  Result := IsAdmin() and ServiceInstalled();
end;

function ApprovalFilePath: string;
begin
  Result := AppDataRoot() + '\uninstall-approval.ini';
end;

function CloseRequestPath: string;
begin
  Result := AppDataRoot() + '\installer-close-request.flag';
end;

function CloseDeniedPath: string;
begin
  Result := AppDataRoot() + '\installer-close-denied.flag';
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
  ForceDirectories(AppDataRoot());
  SaveStringToFile(CloseRequestPath(), GetDateTimeString('yyyy-mm-dd hh:nn:ss', #0, #0), False);
end;

function PreserveInstalledFile(const FileName: string): Boolean;
var
  LowerName: string;
begin
  LowerName := Lowercase(FileName);
  Result :=
    (Pos('unins', LowerName) = 1) or
    (LowerName = '.') or
    (LowerName = '..');
end;

procedure CleanupDirectoryContents(const TargetDir: string; PreserveUninstaller: Boolean);
var
  FindRec: TFindRec;
  ItemPath: string;
begin
  if not DirExists(TargetDir) then
    exit;

  if FindFirst(TargetDir + '\*', FindRec) then
  try
    repeat
      if (FindRec.Name = '.') or (FindRec.Name = '..') then
        continue;
      if PreserveUninstaller and PreserveInstalledFile(FindRec.Name) then
        continue;
      ItemPath := TargetDir + '\' + FindRec.Name;
      if (FindRec.Attributes and FILE_ATTRIBUTE_DIRECTORY) <> 0 then
        DelTree(ItemPath, True, True, True)
      else
        DeleteFile(ItemPath);
    until not FindNext(FindRec);
  finally
    FindClose(FindRec);
  end;
end;

procedure CleanupInstalledBundleFiles(FullRepair: Boolean);
begin
  if DirExists(AppInstallDir()) then
  begin
    if FullRepair then
      CleanupDirectoryContents(AppInstallDir(), True)
    else
    begin
      DelTree(AppInstallDir() + '\_internal', True, True, True);
      DeleteFile(MainAppExePath());
      DeleteFile(ServiceExePath());
      DeleteFile(AppInstallDir() + '\README.txt');
    end;
  end;
end;

procedure CleanupSharedServiceBundle;
begin
  if DirExists(SharedServiceBundleDir('')) then
    DelTree(SharedServiceBundleDir(''), True, True, True);
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
  ServiceInstalledBeforeInstall := ServiceInstalled();

  if ServiceInstalledBeforeInstall and not IsAdmin() then
  begin
    Result := 'May dang co dich vu nen tu ban cai dat truoc. Hay mo app bang quyen Admin va go hoac tat service truoc khi cai ban moi.';
    exit;
  end;

  ServiceWasRunning := ServiceRunning();
  StopInstalledService();
  if not WaitForServiceStop(12) then
  begin
    ForceStopServiceProcess();
    if not WaitForProcessExit('{#MyServiceExeName}', 8) then
    begin
      Result := 'Installer khong the dung service dang chay. Hay dong app va service roi thu lai.';
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
      Result := 'Ung dung dang o strict mode hoac khoa thu cong nen installer khong the tu dong dong no. Hay mo app, nhap dung mat khau roi thu lai.';
      exit;
    end;
    ForceStopAppProcess();
    if not WaitForProcessExit('{#MyAppExeName}', 8) then
    begin
      RestoreServiceIfNeeded(ServiceWasRunning);
      ClearCloseRequest();
      ClearCloseDenied();
      Result := 'Installer khong the dong ung dung dang chay. Hay thoat CaiNghien Focus Guard roi thu lai.';
      exit;
    end;
  end;

  if ExistingInstallDetected then
    CleanupInstalledBundleFiles(RepairMode);
  if RepairMode and IsAdmin() then
    CleanupSharedServiceBundle();

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
  if ServiceInstalled() and not IsAdmin() then
  begin
    MsgBox(
      'Ban dang co service nen da cai. Hay mo bo go cai dat bang Run as administrator de go sach service truoc khi uninstall.',
      mbError,
      MB_OK
    );
    Result := False;
    exit;
  end;

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

function ShouldUpdateInstalledService: Boolean;
begin
  Result := IsAdmin() and ServiceInstalledBeforeInstall and FileExists(SharedServiceExePath());
end;

function ShouldInstallSharedServiceBundle: Boolean;
begin
  Result := IsAdmin() and ServiceInstalledBeforeInstall;
end;

procedure RunServiceMaintenance;
var
  ResultCode: Integer;
begin
  if not ShouldUpdateInstalledService() then
    exit;

  if RepairMode then
  begin
    Exec(
      SharedServiceExePath(),
      'stop',
      '',
      SW_HIDE,
      ewWaitUntilTerminated,
      ResultCode
    );
    Exec(
      SharedServiceExePath(),
      'remove',
      '',
      SW_HIDE,
      ewWaitUntilTerminated,
      ResultCode
    );
    Exec(
      SharedServiceExePath(),
      '--startup auto install',
      '',
      SW_HIDE,
      ewWaitUntilTerminated,
      ResultCode
    );
  end
  else
  begin
    Exec(
      SharedServiceExePath(),
      '--startup auto update',
      '',
      SW_HIDE,
      ewWaitUntilTerminated,
      ResultCode
    );
  end;
  Exec(
    SharedServiceExePath(),
    '--wait 15 start',
    '',
    SW_HIDE,
    ewWaitUntilTerminated,
    ResultCode
  );
end;

procedure InitializeWizard;
var
  VersionText: string;
  InfoLabel: TNewStaticText;
begin
  ExistingInstallDetected := FileExists(MainAppExePath());
  RepairMode := False;
  ServiceInstalledBeforeInstall := False;

  if not ExistingInstallDetected then
    exit;

  InstallModePage := CreateCustomPage(
    wpWelcome,
    'Cap nhat hoac sua chua',
    'Da phat hien CaiNghien Focus Guard tren may nay.'
  );

  InfoLabel := TNewStaticText.Create(InstallModePage);
  InfoLabel.Parent := InstallModePage.Surface;
  InfoLabel.Left := ScaleX(0);
  InfoLabel.Top := ScaleY(0);
  InfoLabel.Width := InstallModePage.SurfaceWidth;
  InfoLabel.AutoSize := False;
  InfoLabel.Height := ScaleY(54);
  if TryGetInstalledVersion(VersionText) then
    InfoLabel.Caption := 'Phien ban hien co: ' + VersionText + #13#10 +
      'Ban co the cap nhat de giu nguyen cau hinh, hoac sua chua de cai lai toan bo file ung dung.'
  else
    InfoLabel.Caption := 'Da tim thay ban cai dat cu. Ban co the cap nhat de giu nguyen cau hinh, hoac sua chua de cai lai toan bo file ung dung.';

  UpdateModeRadio := TRadioButton.Create(InstallModePage);
  UpdateModeRadio.Parent := InstallModePage.Surface;
  UpdateModeRadio.Left := ScaleX(0);
  UpdateModeRadio.Top := InfoLabel.Top + InfoLabel.Height + ScaleY(12);
  UpdateModeRadio.Width := InstallModePage.SurfaceWidth;
  UpdateModeRadio.Checked := True;
  UpdateModeRadio.Caption := 'Cap nhat / nang cap (giu cau hinh, du lieu va startup hien tai)';

  RepairModeRadio := TRadioButton.Create(InstallModePage);
  RepairModeRadio.Parent := InstallModePage.Surface;
  RepairModeRadio.Left := ScaleX(0);
  RepairModeRadio.Top := UpdateModeRadio.Top + ScaleY(30);
  RepairModeRadio.Width := InstallModePage.SurfaceWidth;
  RepairModeRadio.Caption := 'Sua chua (dong app, cai lai tron bo file va cap nhat lai service neu can)';
end;

function NextButtonClick(CurPageID: Integer): Boolean;
begin
  Result := True;
  if (InstallModePage <> nil) and (CurPageID = InstallModePage.ID) then
    RepairMode := RepairModeRadio.Checked;
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
      DelTree(AppDataRoot(), True, True, True);
  end;
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssPostInstall then
    RunServiceMaintenance();
end;
