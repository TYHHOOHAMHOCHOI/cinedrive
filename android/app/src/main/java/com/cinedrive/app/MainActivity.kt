package com.cinedrive.app

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.view.View
import android.widget.Button
import android.widget.ProgressBar
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import androidx.media3.ui.PlayerView
import com.cinedrive.app.api.DriveApiService
import com.cinedrive.app.auth.GoogleAuthManager
import com.cinedrive.app.player.DriveExoPlayer
import kotlinx.coroutines.launch

class MainActivity : AppCompatActivity() {

    private lateinit var authManager: GoogleAuthManager
    private lateinit var drivePlayer: DriveExoPlayer
    private var accessToken: String? = null

    private val signInLauncher = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        if (result.resultCode == Activity.RESULT_OK) {
            val task = com.google.android.gms.auth.api.signin.GoogleSignIn.getSignedInAccountFromIntent(result.data)
            try {
                val account = task.getResult(com.google.android.gms.common.api.ApiException::class.java)
                account?.let { fetchTokenAndLoad(it) }
            } catch (e: Exception) {
                Toast.makeText(this, "Lỗi đăng nhập Google: ${e.message}", Toast.LENGTH_SHORT).show()
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // Simple UI Layout
        val layout = android.widget.LinearLayout(this).apply {
            orientation = android.widget.LinearLayout.VERTICAL
            setBackgroundColor(android.graphics.Color.parseColor("#0B0E14"))
            setPadding(16, 16, 16, 16)
        }

        val btnSignIn = Button(this).apply {
            text = "KẾT NỐI GOOGLE DRIVE"
            setBackgroundColor(android.graphics.Color.parseColor("#E50914"))
            setTextColor(android.graphics.Color.WHITE)
            setOnClickListener { signInLauncher.launch(authManager.getSignInIntent()) }
        }

        val playerView = PlayerView(this).apply {
            layoutParams = android.widget.LinearLayout.LayoutParams(
                android.widget.LinearLayout.LayoutParams.MATCH_PARENT,
                0, 1.0f
            )
            visibility = View.GONE
        }

        layout.addView(btnSignIn)
        layout.addView(playerView)
        setContentView(layout)

        authManager = GoogleAuthManager(this)
        drivePlayer = DriveExoPlayer(this)
        drivePlayer.initializePlayer()
        playerView.player = drivePlayer.getPlayer()

        // Auto login if already signed in
        authManager.getLastSignedInAccount()?.let {
            fetchTokenAndLoad(it)
        }
    }

    private fun fetchTokenAndLoad(account: com.google.android.gms.auth.api.signin.GoogleSignInAccount) {
        lifecycleScope.launch {
            val token = authManager.getAccessToken(account)
            if (token != null) {
                accessToken = token
                Toast.makeText(this@MainActivity, "Đã kết nối Google Drive!", Toast.LENGTH_SHORT).show()
                loadDriveVideos(token)
            } else {
                Toast.makeText(this@MainActivity, "Không lấy được Access Token", Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun loadDriveVideos(token: String) {
        lifecycleScope.launch {
            val api = DriveApiService(token)
            val videos = api.listVideos()
            if (videos.isNotEmpty()) {
                val firstMovie = videos[0]
                Toast.makeText(this@MainActivity, "Đang phát: ${firstMovie.name}", Toast.LENGTH_LONG).show()
                drivePlayer.playDriveVideo(firstMovie.id, token)
            } else {
                Toast.makeText(this@MainActivity, "Chưa tìm thấy phim trong thư mục Cine", Toast.LENGTH_LONG).show()
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        drivePlayer.release()
    }
}
