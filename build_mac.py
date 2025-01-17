import PyInstaller.__main__
import sys
import os
import shutil
import subprocess
import time
import platform

# 获取当前目录
current_dir = os.path.dirname(os.path.abspath(__file__))

# 直接使用确定的ffmpeg和ffprobe路径
ffmpeg_path = '/opt/homebrew/bin/ffmpeg'
ffprobe_path = '/opt/homebrew/bin/ffprobe'

def create_app_structure():
    """创建应用程序目录结构"""
    print("\nCreating application directory structure...")
    app_structure = os.path.join(current_dir, 'dist', 'AudioTranscriber.app', 'Contents')
    macos_dir = os.path.join(app_structure, 'MacOS')
    resources_dir = os.path.join(app_structure, 'Resources')
    
    # 创建目录
    os.makedirs(macos_dir, exist_ok=True)
    os.makedirs(resources_dir, exist_ok=True)
    
    print(f"Created directories:")
    print(f"- {macos_dir}")
    print(f"- {resources_dir}")
    
    return macos_dir, resources_dir

def copy_binaries(macos_dir):
    """复制二进制文件"""
    print("\nCopying ffmpeg and ffprobe...")
    try:
        # 复制ffmpeg
        ffmpeg_dest = os.path.join(macos_dir, 'ffmpeg')
        print(f"Copying {ffmpeg_path} to {ffmpeg_dest}")
        shutil.copy2(ffmpeg_path, ffmpeg_dest)
        os.chmod(ffmpeg_dest, 0o755)
        
        # 复制ffprobe
        ffprobe_dest = os.path.join(macos_dir, 'ffprobe')
        print(f"Copying {ffprobe_path} to {ffprobe_dest}")
        shutil.copy2(ffprobe_path, ffprobe_dest)
        os.chmod(ffprobe_dest, 0o755)
        
        print("Binary files copied and permissions set")
    except Exception as e:
        print(f"Error copying binaries: {str(e)}")
        raise

def build_python():
    """构建Python应用"""
    print("\nBuilding Python application...")
    
    # 获取系统架构
    arch = platform.machine()
    if arch == 'arm64':
        target_arch = 'arm64'
    else:
        target_arch = 'x86_64'
        
    print(f"Building for architecture: {target_arch}")
    
    PyInstaller.__main__.run([
        'src/main.py',
        '--name=AudioTranscriber',
        '--onedir',
        '--windowed',
        '--icon=assets/icon.icns',
        '--distpath=dist',  # 修改输出路径
        f'--target-arch={target_arch}',
        # 添加所有核心Python文件
        '--add-data=src/core:core',
        '--add-data=src/renderer:renderer',
        # 添加模型文件
        '--add-data=models:models',
        # 添加所有必要的隐式依赖
        '--hidden-import=torch',
        '--hidden-import=torchaudio',
        '--hidden-import=whisper',
        '--hidden-import=numpy',
        '--hidden-import=librosa',
        '--hidden-import=sklearn',
        '--hidden-import=pydub',
        '--hidden-import=ffmpeg',
        '--hidden-import=pyannote.audio',
        '--hidden-import=speechbrain',
        # 收集所有必要的包
        '--collect-all=whisper',
        '--collect-all=torch',
        '--collect-all=torchaudio',
        '--collect-all=numpy',
        '--collect-all=librosa',
        '--collect-all=pyannote.audio',
        '--collect-all=speechbrain',
        # 添加运行时钩子
        '--runtime-hook=src/hooks/runtime_hook.py',
        # 添加调试选项
        '--debug=imports',
        '--debug=bootloader',
        # 其他选项
        '--noconfirm',
        '--clean'
    ])

def package_electron(resources_dir):
    """打包Electron部分"""
    print("\nPackaging Electron application...")
    os.system('npm install')
    os.system('npm run build')
    # 复制electron构建结果到Resources目录
    electron_dist = os.path.join(current_dir, 'dist', 'electron')
    if os.path.exists(electron_dist):
        shutil.copytree(electron_dist, resources_dir, dirs_exist_ok=True)

def verify_files(macos_dir):
    """验证文件是否存在"""
    print("\nVerifying files...")
    ffmpeg_dest = os.path.join(macos_dir, 'ffmpeg')
    ffprobe_dest = os.path.join(macos_dir, 'ffprobe')
    
    print(f"Checking {macos_dir}:")
    if os.path.exists(macos_dir):
        print("MacOS directory exists")
        print("Contents:", os.listdir(macos_dir))
    else:
        print("MacOS directory does not exist")
    
    print(f"\nffmpeg exists: {os.path.exists(ffmpeg_dest)}")
    if os.path.exists(ffmpeg_dest):
        print(f"ffmpeg permissions: {oct(os.stat(ffmpeg_dest).st_mode)[-3:]}")
    
    print(f"ffprobe exists: {os.path.exists(ffprobe_dest)}")
    if os.path.exists(ffprobe_dest):
        print(f"ffprobe permissions: {oct(os.stat(ffprobe_dest).st_mode)[-3:]}")

def create_info_plist(contents_dir):
    """创建Info.plist文件"""
    print("\nCreating Info.plist...")
    info_plist_content = '''<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleDisplayName</key>
    <string>AudioTranscriber</string>
    <key>CFBundleExecutable</key>
    <string>AudioTranscriber</string>
    <key>CFBundleIconFile</key>
    <string>icon.icns</string>
    <key>CFBundleIdentifier</key>
    <string>com.chenchen1010.audiotranscriber</string>
    <key>CFBundleInfoDictionaryVersion</key>
    <string>6.0</string>
    <key>CFBundleName</key>
    <string>AudioTranscriber</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0.0</string>
    <key>LSMinimumSystemVersion</key>
    <string>10.15</string>
    <key>NSHighResolutionCapable</key>
    <true/>
    <key>LSArchitecturePriority</key>
    <array>
        <string>arm64</string>
        <string>x86_64</string>
    </array>
    <key>LSRequiresNativeExecution</key>
    <true/>
    <key>NSAppleEventsUsageDescription</key>
    <string>AudioTranscriber needs to access your audio files for transcription.</string>
    <key>NSMicrophoneUsageDescription</key>
    <string>AudioTranscriber needs access to the microphone for audio recording.</string>
</dict>
</plist>
'''
    plist_path = os.path.join(contents_dir, 'Info.plist')
    with open(plist_path, 'w') as f:
        f.write(info_plist_content)
    print(f"Created Info.plist at {plist_path}")

def sign_application(app_path):
    """签名应用程序"""
    print("\nSigning application...")
    try:
        # 移除所有扩展属性
        print("Removing extended attributes...")
        os.system(f'xattr -cr "{app_path}"')
        
        # 签名所有二进制文件和动态库
        print("Signing binaries and libraries...")
        os.system(f'''
            find "{app_path}" -type f \\( -name "*.so" -o -name "*.dylib" -o -name "ffmpeg" -o -name "ffprobe" -o -name "AudioTranscriber" \\) -exec codesign --force --sign - --timestamp --options runtime {{}} \\;
        ''')
        
        # 签名主应用
        print("Signing main application...")
        os.system(f'codesign --force --deep --sign - --timestamp --options runtime --entitlements entitlements.plist "{app_path}"')
        
        # 验证签名
        print("\nVerifying signature...")
        os.system(f'codesign -dvv "{app_path}"')
        
    except Exception as e:
        print(f"Error during signing: {str(e)}")
        raise

def verify_application(app_path):
    """验证应用程序"""
    print("\nPerforming final application verification...")
    
    # 检查应用程序结构
    print("\nChecking application structure:")
    required_dirs = ['Contents/MacOS', 'Contents/Resources']
    for dir_path in required_dirs:
        full_path = os.path.join(app_path, dir_path)
        exists = os.path.exists(full_path)
        print(f"- {dir_path}: {'✓' if exists else '✗'}")
    
    # 检查关键文件
    print("\nChecking key files:")
    key_files = [
        'Contents/Info.plist',
        'Contents/MacOS/AudioTranscriber',
        'Contents/MacOS/ffmpeg',
        'Contents/MacOS/ffprobe'
    ]
    for file_path in key_files:
        full_path = os.path.join(app_path, file_path)
        exists = os.path.exists(full_path)
        if exists:
            permissions = oct(os.stat(full_path).st_mode)[-3:]
            print(f"- {file_path}: ✓ (permissions: {permissions})")
        else:
            print(f"- {file_path}: ✗")
    
    # 检查签名状态
    print("\nChecking signature status:")
    os.system(f'codesign -dvv "{app_path}" 2>&1')

def clean_build():
    """清理构建目录"""
    print("\nCleaning previous build...")
    try:
        # 先修改权限，再删除
        if os.path.exists('dist'):
            subprocess.run(['sudo', 'chmod', '-R', '777', 'dist'], check=True)
        if os.path.exists('build'):
            subprocess.run(['sudo', 'chmod', '-R', '777', 'build'], check=True)
        if os.path.exists('__pycache__'):
            subprocess.run(['sudo', 'chmod', '-R', '777', '__pycache__'], check=True)
            
        # 删除目录
        subprocess.run(['sudo', 'rm', '-rf', 'dist'], check=True)
        subprocess.run(['sudo', 'rm', '-rf', 'build'], check=True)
        subprocess.run(['sudo', 'rm', '-rf', '__pycache__'], check=True)
        
        # 重新设置当前目录的权限
        subprocess.run(['sudo', 'chown', '-R', f'{os.getenv("USER")}:staff', '.'], check=True)
        subprocess.run(['sudo', 'chmod', '-R', '755', '.'], check=True)
        
        print("Clean completed successfully")
    except subprocess.CalledProcessError as e:
        print(f"Error during cleaning: {str(e)}")
        raise

def create_app_bundle():
    """创建应用程序包结构"""
    print("\nCreating application bundle...")
    app_path = os.path.join(current_dir, 'dist', 'AudioTranscriber.app')
    contents_dir = os.path.join(app_path, 'Contents')
    macos_dir = os.path.join(contents_dir, 'MacOS')
    resources_dir = os.path.join(contents_dir, 'Resources')
    frameworks_dir = os.path.join(contents_dir, 'Frameworks')
    
    # 创建目录结构
    os.makedirs(macos_dir, exist_ok=True)
    os.makedirs(resources_dir, exist_ok=True)
    os.makedirs(frameworks_dir, exist_ok=True)
    
    # 移动PyInstaller生成的文件
    dist_dir = os.path.join(current_dir, 'dist', 'AudioTranscriber')
    if os.path.exists(dist_dir):
        # 移动主程序
        shutil.move(
            os.path.join(dist_dir, 'AudioTranscriber'),
            os.path.join(macos_dir, 'AudioTranscriber')
        )
        # 移动其他文件
        for item in os.listdir(dist_dir):
            src = os.path.join(dist_dir, item)
            if item != 'AudioTranscriber':
                dst = os.path.join(resources_dir, item)
                shutil.move(src, dst)
    
    return macos_dir, resources_dir

def main():
    # 清理构建
    clean_build()
    
    # 执行打包步骤
    build_python()
    time.sleep(2)
    
    # 创建应用程序包
    macos_dir, resources_dir = create_app_bundle()
    
    # 创建Info.plist
    contents_dir = os.path.dirname(macos_dir)
    create_info_plist(contents_dir)
    
    # 复制二进制文件
    copy_binaries(macos_dir)
    package_electron(resources_dir)
    
    # 设置执行权限
    print("\nSetting permissions...")
    os.system(f'sudo chmod +x "{os.path.join(macos_dir, "AudioTranscriber")}"')
    os.system(f'sudo chmod +x "{os.path.join(macos_dir, "ffmpeg")}"')
    os.system(f'sudo chmod +x "{os.path.join(macos_dir, "ffprobe")}"')
    
    # 确保整个应用目录权限正确
    app_path = os.path.join(current_dir, 'dist', 'AudioTranscriber.app')
    os.system(f'sudo chmod -R 755 "{app_path}"')
    os.system(f'sudo chown -R {os.getenv("USER")}:staff "{app_path}"')
    
    # 签名应用
    sign_application(app_path)
    
    # 验证应用
    verify_application(app_path)
    
    print("\nBuild complete! Please check the verification results above.")

if __name__ == "__main__":
    main() 