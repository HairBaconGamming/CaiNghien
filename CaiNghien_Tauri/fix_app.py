import os

with open('CaiNghien_Tauri/src/App.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

replacements = {
    '''const [updateObj, setUpdateObj] = useState<any>(null);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);''': '''const [updateObj, setUpdateObj] = useState<any>(null);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [notifications, setNotifications] = useState<import('./components/layout/Navbar').Notification[]>([
    {
      id: 'welcome',
      title: 'Chào mừng trở lại',
      message: 'Hệ thống đã sẵn sàng bảo vệ sự tập trung của bạn.',
      read: false,
      timestamp: 'Vừa xong'
    }
  ]);
  
  const handleMarkNotificationsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };''',
    '''        <Navbar
          activeTab={activeTab}
          onSelectTab={handleSelectTab}
          userLevel={userProfile?.level}
          userTitle={userProfile?.title}
          hasNotifications={true}
        />''': '''        <Navbar
          activeTab={activeTab}
          onSelectTab={handleSelectTab}
          userLevel={userProfile?.level}
          notifications={notifications}
          onMarkNotificationsRead={handleMarkNotificationsRead}
        />''',
    '''      try {
        const update = await check();
        if (update) {
          setUpdateObj(update);
        } else {
          addToast('info', "Hệ thống đã được cập nhật phiên bản mới nhất.");
        }
      } catch (e) {
        console.error(e);
        addToast('error', "Không thể kiểm tra cập nhật. Vui lòng thử lại sau.");
      }''': '''      try {
        const update = await check();
        if (update && update.version) {
          setUpdateObj(update);
          setNotifications(prev => [{
            id: 'update-' + Date.now(),
            title: 'Có bản cập nhật mới',
            message: `Phiên bản ${update.version} đã sẵn sàng. Bạn có thể cập nhật trong phần Cài đặt.`,
            read: false,
            timestamp: 'Ngay bây giờ'
          }, ...prev]);
        } else {
          addToast('info', "Hệ thống đã được cập nhật phiên bản mới nhất.");
        }
      } catch (e) {
        console.error(e);
        addToast('error', "Không thể kiểm tra cập nhật (thiếu pubkey hoặc mất mạng).");
      }'''
}

for k, v in replacements.items():
    text = text.replace(k, v)

with open('CaiNghien_Tauri/src/App.tsx', 'w', encoding='utf-8') as f:
    f.write(text)
print('Done!')
