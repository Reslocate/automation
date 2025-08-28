import { useState, useEffect } from 'react';
import { Bot, CheckCircle, XCircle, Loader, Facebook } from 'lucide-react';
import PostComposer from './components/PostComposer';
import PlatformSelector from './components/PlatformSelector';
import type { Post } from '@/types';
import { LocalStorageService } from './services/localStorageService';

type PostStatus = 'idle' | 'posting' | 'success' | 'failed';

function App() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [postStatus, setPostStatus] = useState<PostStatus>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [debugStatus, setDebugStatus] = useState<'idle' | 'launching' | 'success' | 'failed'>('idle');
  const [debugMessage, setDebugMessage] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['facebook']);

  // Load posts from localStorage on component mount
  useEffect(() => {
    const loadPosts = async () => {
      const storedPosts = await LocalStorageService.getPosts();
      setPosts(storedPosts);
    };
    loadPosts();
  }, []);

  const handlePostCreate = async (postData: Omit<Post, 'id' | 'createdAt' | 'platforms'>, headlessMode: boolean) => {
    const newPost: Post = {
      ...postData,
      platforms: selectedPlatforms,
      id: Date.now().toString(),
      createdAt: new Date(),
    };

    setPostStatus('posting');
    setStatusMessage(`Starting Facebook automation with caption: "${postData.caption.substring(0, 50)}${postData.caption.length > 50 ? '...' : ''}"`);

    // Determine environment variables based on headless mode
    const envVars = {
      HEADLESS: headlessMode ? 'true' : 'false',
      KEEP_BROWSER_OPEN: headlessMode ? 'false' : 'true',
      headless: headlessMode,
      keepBrowserOpen: !headlessMode
    };

    let successCount = 0;
    let failCount = 0;
    let detailedResults: string[] = [];

    // Execute automation for each selected platform
    for (const platformId of selectedPlatforms) {
      try {
        setStatusMessage(`Posting to ${platformId}... Please wait.`);
        
        let endpoint = '';
        switch (platformId) {
          case 'facebook':
            endpoint = '/api/automation/run-facebook-debug';
            break;
          case 'instagram':
            endpoint = '/api/automation/run-instagram-debug';
            break;
          case 'twitter':
            endpoint = '/api/automation/run-twitter-debug';
            break;
          // Add cases for other platforms as endpoints are implemented
          default:
            console.warn(`No endpoint configured for platform: ${platformId}`);
            detailedResults.push(`❌ ${platformId}: No endpoint configured`);
            continue;
        }

        const response = await fetch(`http://localhost:3002${endpoint}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            caption: newPost.caption,
            ...envVars
          }),
        });

        const result = await response.json();

        if (response.ok && result.success) {
          successCount++;
          detailedResults.push(`✅ ${platformId}: ${result.message || 'Posted successfully'}`);
          console.log(`✅ Successfully posted to ${platformId}:`, result);
        } else {
          failCount++;
          detailedResults.push(`❌ ${platformId}: ${result.error || 'Unknown error'}`);
          console.error(`Failed to post to ${platformId}:`, result.error);
          
          // Log troubleshooting info if available
          if (result.troubleshooting) {
            console.log(`💡 Troubleshooting for ${platformId}:`, result.troubleshooting);
          }
        }
      } catch (error) {
        failCount++;
        detailedResults.push(`❌ ${platformId}: Network error - ${error instanceof Error ? error.message : 'Unknown error'}`);
        console.error(`Error posting to ${platformId}:`, error);
      }
    }

    // Update status based on results
    if (successCount > 0 && failCount === 0) {
      const publishedPost = { ...newPost, status: 'published' as const };
      setPostStatus('success');
      setStatusMessage(`🎉 Successfully published to ${successCount} platform(s)! ${detailedResults.join(' | ')}`);
      setPosts([publishedPost, ...posts]);
      // Save to localStorage
      await LocalStorageService.savePost(newPost, selectedPlatforms);
    } else if (successCount > 0) {
      const publishedPost = { ...newPost, status: 'published' as const };
      setPostStatus('success');
      setStatusMessage(`⚠️ Partial success: ${successCount} succeeded, ${failCount} failed. ${detailedResults.join(' | ')}`);
      setPosts([publishedPost, ...posts]);
      // Save to localStorage
      await LocalStorageService.savePost(newPost, selectedPlatforms);
    } else {
      const failedPost = { ...newPost, status: 'failed' as const };
      setPostStatus('failed');
      setStatusMessage(`❌ Failed to publish to any platforms. ${detailedResults.join(' | ')}`);
      setPosts([failedPost, ...posts]);
      // Save failed attempt to localStorage
      await LocalStorageService.savePost(newPost, selectedPlatforms);
    }

    // Reset status after 10 seconds (longer to read detailed results)
    setTimeout(() => {
      setPostStatus('idle');
      setStatusMessage('');
    }, 10000);
  };

  const getStatusIcon = () => {
    switch (postStatus) {
      case 'posting':
        return <Loader className="w-6 h-6 text-blue-600 animate-spin" />;
      case 'success':
        return <CheckCircle className="w-6 h-6 text-green-600" />;
      case 'failed':
        return <XCircle className="w-6 h-6 text-red-600" />;
      default:
        return null;
    }
  };

  const handleLaunchChromium = async () => {
    setDebugStatus('launching');
    setDebugMessage('Launching Facebook automation with visible browser...');

    try {
      const response = await fetch('http://localhost:3002/api/automation/run-facebook-debug', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          caption: 'Debug test post from automation dashboard',
          headless: false,
          keepBrowserOpen: true
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setDebugStatus('success');
        setDebugMessage(`✅ Facebook automation completed! ${result.posted ? 'Post was created successfully.' : 'Check browser window for results.'}`);
      } else {
        setDebugStatus('failed');
        setDebugMessage(`❌ ${result.error || 'Facebook automation failed'} - Check console for details.`);
        
        // Log troubleshooting info
        if (result.troubleshooting) {
          console.log('💡 Troubleshooting suggestions:', result.troubleshooting);
        }
      }
    } catch {
      setDebugStatus('failed');
      setDebugMessage('❌ Network error - Make sure automation server is running on port 3002');
    }

    // Reset status after 8 seconds
    setTimeout(() => {
      setDebugStatus('idle');
      setDebugMessage('');
    }, 8000);
  };

  const getDebugStatusIcon = () => {
    switch (debugStatus) {
      case 'launching':
        return <Loader className="w-6 h-6 text-blue-600 animate-spin" />;
      case 'success':
        return <CheckCircle className="w-6 h-6 text-green-600" />;
      case 'failed':
        return <XCircle className="w-6 h-6 text-red-600" />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Tailwind Test Div */}
      <div className="fixed bottom-4 right-4 p-4 bg-blue-600 text-white rounded-lg shadow-lg">
        Tailwind Test
      </div>
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-2 rounded-lg mr-3">
                <Facebook className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Social Media Manager</h1>
                <p className="text-xs text-gray-600">Multi-Platform Automation</p>
              </div>
            </div>
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <Bot className="w-4 h-4" />
              <span>Puppeteer/Playwright Ready</span>
            </div>
          </div>
        </div>
      </header>

      {/* Status Bar */}
      {postStatus !== 'idle' && (
        <div className={`border-b ${
          postStatus === 'posting' ? 'bg-blue-50 border-blue-200' :
          postStatus === 'success' ? 'bg-green-50 border-green-200' :
          'bg-red-50 border-red-200'
        }`}>
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <div className="flex items-center">
              {getStatusIcon()}
              <span className={`ml-3 text-sm font-medium ${
                postStatus === 'posting' ? 'text-blue-800' :
                postStatus === 'success' ? 'text-green-800' :
                'text-red-800'
              }`}>
                {statusMessage}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Debug Status Bar */}
      {debugStatus !== 'idle' && (
        <div className={`border-b ${
          debugStatus === 'launching' ? 'bg-blue-50 border-blue-200' :
          debugStatus === 'success' ? 'bg-green-50 border-green-200' :
          'bg-red-50 border-red-200'
        }`}>
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <div className="flex items-center">
              {getDebugStatusIcon()}
              <span className={`ml-3 text-sm font-medium ${
                debugStatus === 'launching' ? 'text-blue-800' :
                debugStatus === 'success' ? 'text-green-800' :
                'text-red-800'
              }`}>
                {debugMessage}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          {/* Platform Selector */}
          <PlatformSelector
            selectedPlatforms={selectedPlatforms}
            onPlatformChange={setSelectedPlatforms}
          />

          {/* Post Composer */}
          <PostComposer
            onPostCreate={handlePostCreate}
            isPosting={postStatus === 'posting'}
            selectedPlatforms={selectedPlatforms}
          />

          {/* Launch Chromium Button */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center mb-6">
              <div className="bg-gradient-to-r from-purple-600 to-purple-700 p-2 rounded-lg mr-3">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Debug Tools</h2>
            </div>
            
            <button
              onClick={handleLaunchChromium}
              disabled={debugStatus === 'launching'}
              className="w-full bg-gradient-to-r from-purple-600 to-purple-700 text-white py-3 px-4 rounded-lg font-medium hover:from-purple-700 hover:to-purple-800 focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center"
            >
              {debugStatus === 'launching' ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Launching Chromium...
                </>
              ) : (
                <>
                  <Bot className="w-4 h-4 mr-2" />
                  Launch With Chromium
                </>
              )}
            </button>
            <p className="text-sm text-gray-500 mt-3 text-center">
              Test the Facebook automation script with a visible browser
            </p>
          </div>

          {/* Recent Posts */}
          {posts.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Posts</h3>
              <div className="space-y-4">
                {posts.slice(0, 5).map((post) => (
                  <div key={post.id} className="flex items-start space-x-4 p-4 bg-gray-50 rounded-lg">
                    <div className="flex-shrink-0">
                      {post.status === 'published' ? (
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900 truncate">{post.caption}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {post.createdAt.toLocaleString()} • 
                        <span className={`ml-1 ${post.status === 'published' ? 'text-green-600' : 'text-red-600'}`}>
                          {post.status === 'published' ? 'Published' : 'Failed'}
                        </span>
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
