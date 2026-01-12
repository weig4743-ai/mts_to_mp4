/**
 * 针对 DV 相机优化的 MTS 转 MP4 逻辑
 * 核心思路：优先尝试不损画质的极速封装，失败则切换至去隔行重编码。
 */

const { createFFmpeg, fetchFile } = FFmpeg;

// 初始化 FFmpeg，使用稳定版本的核心
const ffmpeg = createFFmpeg({
    log: true,
    corePath: 'https://unpkg.com/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js'
});

const uploader = document.getElementById('uploader');
const status = document.getElementById('status');
const progressBar = document.getElementById('progress-bar');
const progBox = document.getElementById('prog-box');
const player = document.getElementById('player');

// 读取文件的辅助函数，针对大文件进行优化
const readFileAsArrayBuffer = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
};

uploader.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // 内存预警：如果文件大于 800MB，提醒用户 Safari 可能会刷新
    if (file.size > 800 * 1024 * 1024) {
        status.innerHTML = "⚠️ 文件较大，iPhone 内存可能不足。请保持屏幕常亮并勿切换后台。";
    }

    try {
        // 1. 加载引擎
        if (!ffmpeg.isLoaded()) {
            status.innerText = "⏳ 正在唤醒转码引擎...";
            await ffmpeg.load();
        }

        // 2. 清理旧数据
        try {
            ffmpeg.FS('unlink', 'input.mts');
            ffmpeg.FS('unlink', 'output.mp4');
        } catch (e) {}

        // 3. 读取并写入文件
        status.innerText = "📂 正在载入 DV 视频原始数据...";
        progBox.style.display = 'block';
        const arrayBuffer = await readFileAsArrayBuffer(file);
        ffmpeg.FS('writeFile', 'input.mts', new Uint8Array(arrayBuffer));

        // 4. 设置进度条逻辑
        ffmpeg.setProgress(({ ratio }) => {
            const p = Math.floor(ratio * 95); // 留 5% 给封装过程
            progressBar.style.width = `${p}%`;
        });

        // 5. 执行转换：首选【极速流拷贝模式】
        status.innerText = "🚀 正在进行极速封装 (流拷贝)...";
        
        let success = true;
        try {
            /**
             * 命令解析：
             * -c:v copy: 视频流不重编码（保持 DV 原画质，速度极快）
             * -c:a aac: 音频转为 AAC（解决 DV 原生 AC3 音频在 iPhone 没声音的问题）
             * -movflags faststart: 优化 MP4 结构，让手机能秒开播放
             */
            await ffmpeg.run(
                '-i', 'input.mts', 
                '-c:v', 'copy', 
                '-c:a', 'aac', 
                '-map_metadata', '0', 
                '-movflags', 'faststart', 
                'output.mp4'
            );
        } catch (err) {
            console.log("极速模式失败，尝试标准兼容模式...");
            success = false;
        }

        // 6. 如果极速模式失败（某些老旧 DV 编码不兼容），则进入【去隔行扫描重编码模式】
        if (!success) {
            status.innerText = "⚠️ 极速模式不兼容，正在进行深度转码并修复横纹...";
            await ffmpeg.run(
                '-i', 'input.mts',
                '-vf', 'yadif',           // 关键：修复 DV 的隔行扫描横纹（De-interlacing）
                '-c:v', 'libx264',        // 重新编码为 H.264
                '-preset', 'ultrafast',   // 针对手机端最快速度优化
                '-crf', '26',             // 平衡画质与体积
                '-pix_fmt', 'yuv420p',    // 确保 iOS 相册完美兼容
                '-c:a', 'aac',
                'output.mp4'
            );
        }

        // 7. 导出视频
        status.innerText = "🎉 转码完成！正在准备预览...";
        const data = ffmpeg.FS('readFile', 'output.mp4');
        const url = URL.createObjectURL(new Blob([data.buffer], { type: 'video/mp4' }));
        
        player.src = url;
        player.style.display = 'block';
        progressBar.style.width = '100%';
        status.innerHTML = `✅ 转换成功！<br>请<strong>长按下方视频</strong>选择“保存到照片”`;

        // 8. 彻底清理内存
        ffmpeg.FS('unlink', 'input.mts');
        // 注意：output.mp4 暂不清理，直到用户刷新或转换下一个文件

    } catch (err) {
        console.error(err);
        status.innerHTML = "❌ 转换失败：内存溢出或格式不支持。<br>建议刷新页面或尝试更小的片段。";
    }
});
