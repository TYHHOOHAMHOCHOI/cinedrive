package com.cinedrive.app.player

import android.content.Context
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.datasource.DefaultHttpDataSource
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory

/**
 * DriveExoPlayer
 * Trình phát video chuyên nghiệp tối ưu cho Google Drive stream:
 * - Tự động đính kèm Authorization: Bearer <AccessToken>
 * - Tự động gửi HTTP Range Header khi tua video (Seek)
 * - Quản lý buffer và hỗ trợ thay đổi tốc độ, lắng nghe sự kiện
 */
class DriveExoPlayer(private val context: Context) {

    private var exoPlayer: ExoPlayer? = null
    private var currentAccessToken: String? = null

    fun initializePlayer(onPlaybackStateChanged: (Int) -> Unit = {}) {
        val player = ExoPlayer.Builder(context).build()
        player.addListener(object : Player.Listener {
            override fun onPlaybackStateChanged(playbackState: Int) {
                onPlaybackStateChanged(playbackState)
            }
        })
        exoPlayer = player
    }

    /**
     * Phát video trực tiếp từ Google Drive bằng File ID
     */
    fun playDriveVideo(fileId: String, accessToken: String, startPositionMs: Long = 0L) {
        this.currentAccessToken = accessToken
        val streamUrl = "https://www.googleapis.com/drive/v3/files/$fileId?alt=media"

        // Cấu hình DefaultHttpDataSource để đính kèm Token xác thực và hỗ trợ Range Header
        val httpDataSourceFactory = DefaultHttpDataSource.Factory()
            .setAllowCrossProtocolRedirects(true)
            .setConnectTimeoutMs(15000)
            .setReadTimeoutMs(15000)
            .setDefaultRequestProperties(
                mapOf(
                    "Authorization" to "Bearer $accessToken"
                )
            )

        val mediaSourceFactory = DefaultMediaSourceFactory(httpDataSourceFactory)

        // Khởi tạo hoặc cập nhật MediaSource
        val mediaItem = MediaItem.Builder()
            .setUri(streamUrl)
            .build()

        val mediaSource = mediaSourceFactory.createMediaSource(mediaItem)

        exoPlayer?.apply {
            setMediaSource(mediaSource)
            if (startPositionMs > 0) {
                seekTo(startPositionMs)
            }
            prepare()
            playWhenReady = true
        }
    }

    fun seekForward(seconds: Long = 10) {
        exoPlayer?.let {
            val target = (it.currentPosition + seconds * 1000).coerceAtMost(it.duration)
            it.seekTo(target)
        }
    }

    fun seekBackward(seconds: Long = 10) {
        exoPlayer?.let {
            val target = (it.currentPosition - seconds * 1000).coerceAtLeast(0)
            it.seekTo(target)
        }
    }

    fun setSpeed(speed: Float) {
        exoPlayer?.setPlaybackSpeed(speed)
    }

    fun pause() {
        exoPlayer?.pause()
    }

    fun play() {
        exoPlayer?.play()
    }

    fun release() {
        exoPlayer?.release()
        exoPlayer = null
    }

    fun getCurrentPosition(): Long = exoPlayer?.currentPosition ?: 0L
    fun getDuration(): Long = exoPlayer?.duration ?: 0L
    fun isPlaying(): Boolean = exoPlayer?.isPlaying ?: false
    fun getPlayer(): ExoPlayer? = exoPlayer
}
