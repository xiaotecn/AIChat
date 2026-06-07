# 🔧 页面没有变化？解决方案

如果你访问管理后台但看不到 API 数据，请尝试以下方法：

## 方法 1：强制刷新浏览器（推荐）

### Chrome / Edge
按 `Ctrl + Shift + R` (Windows)  
或 `Cmd + Shift + R` (Mac)

### Firefox
按 `Ctrl + F5` (Windows)  
或 `Cmd + Shift + R` (Mac)

---

## 方法 2：清除浏览器缓存

### Chrome / Edge
1. 按 `F12` 打开开发者工具
2. 右键点击刷新按钮
3. 选择"清空缓存并硬性重新加载"

### 或者
1. 打开 `设置 > 隐私和安全 > 清除浏览数据`
2. 选择"缓存的图像和文件"
3. 点击"清除数据"

---

## 方法 3：隐身/无痕模式

### Chrome / Edge
按 `Ctrl + Shift + N`

### Firefox
按 `Ctrl + Shift + P`

然后访问: http://localhost:3000/admin

---

## 方法 4：检查控制台

1. 按 `F12` 打开开发者工具
2. 切换到 "Console" 标签
3. 查看是否有错误信息
4. 切换到 "Network" 标签
5. 刷新页面
6. 查看 API 请求（应该看到 `/api/admin/stats` 等请求）

---

## 验证 API 是否工作

打开新标签页，访问这些 URL：

### 统计数据
http://localhost:3000/api/admin/stats

应该看到 JSON 数据：
```json
{
  "success": true,
  "data": {
    "users": {
      "total": 1234,
      "active": 856,
      ...
    }
  }
}
```

### 用户列表
http://localhost:3000/api/admin/users

### 套餐列表
http://localhost:3000/api/admin/plans

如果这些 API 都能正常显示 JSON 数据，说明后端没问题，只是前端缓存。

---

## 还是不行？

请告诉我：

1. 浏览器开发者工具的 Console 里有什么错误？
2. Network 标签里能看到 API 请求吗？
3. API URL 直接访问能看到数据吗？
4. 你看到的是什么？（完全空白？还是显示旧数据？）

---

## 当前 API 状态

✅ 服务器运行中: http://localhost:3000  
✅ API 正常工作: `/api/admin/stats` 返回 200  
✅ 数据正常: users.total = 1234  

问题很可能是浏览器缓存，强制刷新应该能解决！
