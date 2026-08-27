package com.cinedrive.app.auth

import android.app.Activity
import android.content.Context
import android.content.Intent
import com.google.android.gms.auth.GoogleAuthUtil
import com.google.android.gms.auth.api.signin.GoogleSignIn
import com.google.android.gms.auth.api.signin.GoogleSignInAccount
import com.google.android.gms.auth.api.signin.GoogleSignInClient
import com.google.android.gms.auth.api.signin.GoogleSignInOptions
import com.google.android.gms.common.api.Scope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * GoogleAuthManager
 * Xử lý xác thực Google Sign-In native trên Android và cấp Access Token để stream từ Drive.
 */
class GoogleAuthManager(private val context: Context) {

    private val driveScope = Scope("https://www.googleapis.com/auth/drive.readonly")
    private val profileScope = Scope("https://www.googleapis.com/auth/userinfo.profile")

    private val gso = GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
        .requestEmail()
        .requestScopes(driveScope, profileScope)
        .build()

    private val googleSignInClient: GoogleSignInClient = GoogleSignIn.getClient(context, gso)

    fun getSignInIntent(): Intent {
        return googleSignInClient.signInIntent
    }

    fun getLastSignedInAccount(): GoogleSignInAccount? {
        return GoogleSignIn.getLastSignedInAccount(context)
    }

    /**
     * Lấy chuỗi Access Token từ GoogleSignInAccount (chạy trên background thread)
     */
    suspend fun getAccessToken(account: GoogleSignInAccount): String? = withContext(Dispatchers.IO) {
        try {
            val scopeStr = "oauth2:https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/userinfo.profile"
            GoogleAuthUtil.getToken(context, account.account!!, scopeStr)
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }

    fun signOut(onComplete: () -> Unit = {}) {
        googleSignInClient.signOut().addOnCompleteListener {
            onComplete()
        }
    }
}
