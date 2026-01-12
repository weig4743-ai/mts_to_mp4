const { createFFmpeg, fetchFile } = FFmpeg;

// 初始化 FFmpeg 实例
const ffmpeg = createFFmpeg({
    log: true,
    corePath: 'https://unpkg.com/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js'
});

const uploader = document.getElementById('uploader');
const status = document.getElementById('status');
const progressBar = document.getElementById('progress-bar');
const progBox = document.getElementById('prog-box');
const player = document.getElementById('player');

uploader.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
        status.innerText = "正在初始化引擎...";
        if (!ffmpeg.isLoaded()) await ffmpeg.load();

        status.innerText = "读取文件中...";
        progBox.style.display = 'block';
        
        // 写入虚拟文件系统
        ffmpeg.FS('writeFile', 'input.mts', await fetchFile(file));

        status.innerText = "正在转码... 请勿关闭页面";
        
        // 进度监听
        ffmpeg.setProgress(({ ratio }) => {
            progressBar.style.width = `${(ratio * 100).toFixed(0)}%`;
        });

        /* 核心转换指令：
           -i input.mts: 输入文件
           -c:v libx264: 强制转为 H.264 编码（iPhone 兼容性最好）
           -preset ultrafast: 牺牲一点体积换取极快的转码速度
           -pix_fmt yuv420p: 确保 iPhone 视频播放器能打开
           -c:a aac: 音频转为 AAC 格式
        */
        await ffmpeg.run(
            '-i', 'input.mts', 
            '-c:v', 'libx264', 
            '-preset', 'ultrafast', 
            '-pix_fmt', 'yuv420p', 
            '-c:a', 'aac', 
            'output.mp4'
        );

        status.innerText = "转码完成！正在生成预览...";
        
        // 读取转码后的文件
        const data = ffmpeg.FS('readFile', 'output.mp4');
        const url = URL.createObjectURL(new Blob([data.buffer], { type: 'video/mp4' }));
        
        // 显示结果
        player.src = url;
        player.style.display = 'block';
        status.innerHTML = `✅ 转换成功！<br>长按上方视频选择“保存到照片”`;

        // 自动清理内存
        ffmpeg.FS('unlink', 'input.mts');
        ffmpeg.FS('unlink', 'output.mp4');

    } catch (err) {
        console.error(err);
        status.innerText = "发生错误: " + err.message;
    }
});
