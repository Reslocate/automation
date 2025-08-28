# React + TypeScript + Vite

# Social Media Automation Manager

A comprehensive social media automation platform with intelligent browser automation for Facebook, Instagram, and Twitter posting.

## 🚀 Features

- **Multi-Platform Posting**: Automated posting to Facebook, Instagram, and Twitter
- **Intelligent Browser Automation**: Uses Puppeteer with human-like interactions
- **Enhanced Error Handling**: Comprehensive retry logic and failure recovery
- **Real-time Status Updates**: Live feedback on automation progress
- **Debug Mode**: Visible browser automation for troubleshooting
- **Secure Credential Management**: Environment-based credential storage

## 🛠️ Setup Instructions

### 1. Install Dependencies
```bash
npm install
cd automation-server && npm install
```

### 2. Configure Environment Variables
Create a `.env` file in the root directory:
```env
# Facebook Credentials
FB_USERNAME=your_facebook_email@example.com
FB_PASSWORD=your_facebook_password

# Instagram Credentials
INSTAGRAM_USERNAME=your_instagram_username
INSTAGRAM_PASSWORD=your_instagram_password

# Twitter Credentials
TWITTER_USERNAME=your_twitter_email@example.com
TWITTER_PASSWORD=your_twitter_password

# Browser Settings
HEADLESS=false
KEEP_BROWSER_OPEN=true
BROWSER_TIMEOUT=60000
```

### 3. Start the Application
```bash
# Terminal 1: Start the automation server
cd automation-server
npm start

# Terminal 2: Start the frontend
npm run dev
```

## 🔧 Recent Improvements

### Facebook Automation Enhancements
- **Enhanced Post Box Discovery**: Multiple selector strategies for finding Facebook's post input
- **Improved Button Detection**: Comprehensive Post button discovery with fallback methods
- **Better Error Handling**: Detailed error messages and troubleshooting suggestions
- **Retry Logic**: Up to 5 retry attempts with page refresh between attempts
- **Human-like Typing**: Realistic typing patterns with variable delays
- **Success Verification**: Post confirmation detection

### Technical Improvements
- **Robust Element Detection**: Multiple fallback selectors for UI changes
- **Enhanced Debugging**: Comprehensive screenshot capture and element analysis
- **Better Status Reporting**: Detailed success/failure messages in the UI
- **Timeout Management**: Proper timeout handling for long-running operations
- **Memory Management**: Improved browser resource handling

## 🐛 Troubleshooting

### Common Issues and Solutions

1. **"Post box not found"**
   - Facebook may have updated their UI
   - Check debug screenshots in `debug-screenshots/` folder
   - Try running with visible browser mode

2. **"Login failed"**
   - Verify credentials in `.env` file
   - Check for 2FA or security challenges
   - Try manual login to check account status

3. **"Security challenge detected"**
   - Facebook requires manual verification
   - Complete the challenge in the browser
   - Account may need verification

4. **"Network error"**
   - Ensure automation server is running on port 3002
   - Check internet connection
   - Verify firewall settings

## 📁 Project Structure

```
├── src/                    # Frontend React application
├── automation-server/      # Backend automation server
├── facebook-login-post-test.js  # Enhanced Facebook automation
├── instagram-login-post-test.js # Instagram automation
├── twitter-login-post-test.js   # Twitter automation
└── debug-screenshots/      # Automation debugging screenshots
```

## 🔒 Security Notes

- Credentials are stored in environment variables
- Passwords are masked in logs
- Browser automation can run in headless mode
- No credentials are hardcoded in the application

## 🚀 Usage

1. **Select Platforms**: Choose Facebook, Instagram, or Twitter
2. **Write Caption**: Enter your post content
3. **Choose Mode**: Headless (background) or Visible (watch automation)
4. **Post**: Click to start automation
5. **Monitor**: Watch real-time status updates

## 📊 Success Indicators

- ✅ **Green Status**: Post successfully created
- ⚠️ **Yellow Status**: Partial success (some platforms failed)
- ❌ **Red Status**: All platforms failed
- 🔵 **Blue Status**: Automation in progress

## 🔄 Retry Logic

The system includes intelligent retry mechanisms:
- Up to 5 retry attempts per platform
- Page refresh between retries
- Progressive delay increases
- Detailed failure analysis

## 📝 Logging

Comprehensive logging includes:
- Step-by-step automation progress
- Screenshot capture at each step
- Detailed error messages
- Performance metrics
- Success/failure analysis

---

**Note**: This tool is for educational and personal use. Always comply with platform terms of service and rate limiting guidelines.
```



export default tseslint.config([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
