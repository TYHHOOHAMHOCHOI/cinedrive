package com.cinedrive.app.api

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

data class DriveFile(
    val id: String,
    val name: String,
    val mimeType: String,
    val size: Long?,
    val thumbnailLink: String?
)

/**
 * DriveApiService
 * Gọi trực tiếp REST API của Google Drive v3 để lấy danh sách phim (giới hạn trong thư mục Cine)
 */
class DriveApiService(private val accessToken: String) {

    private val apiBase = "https://www.googleapis.com/drive/v3"
    private var cachedCineFolderId: String? = null

    /**
     * Tìm ID của thư mục tên "Cine" trên Google Drive
     */
    private suspend fun findCineFolderId(): String? = withContext(Dispatchers.IO) {
        cachedCineFolderId?.let { return@withContext it }
        try {
            val q = URLEncoder.encode("trashed = false and mimeType = 'application/vnd.google-apps.folder' and (name = 'Cine' or name = 'cine')", "UTF-8")
            val urlString = "$apiBase/files?q=$q&fields=files(id,name)&pageSize=1"
            val url = URL(urlString)
            val conn = url.openConnection() as HttpURLConnection
            conn.requestMethod = "GET"
            conn.setRequestProperty("Authorization", "Bearer $accessToken")

            if (conn.responseCode == 200) {
                val reader = BufferedReader(InputStreamReader(conn.inputStream))
                val response = reader.readText()
                reader.close()
                val json = JSONObject(response)
                val files = json.optJSONArray("files")
                if (files != null && files.length() > 0) {
                    val id = files.getJSONObject(0).getString("id")
                    cachedCineFolderId = id
                    return@withContext id
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
        return@withContext null
    }

    suspend fun listVideos(folderId: String? = null): List<DriveFile> = withContext(Dispatchers.IO) {
        val fileList = mutableListOf<DriveFile>()
        try {
            val targetFolderId = folderId ?: findCineFolderId()

            var q = "trashed = false and (mimeType contains 'video/' or name contains '.mp4' or name contains '.mkv')"
            if (!targetFolderId.isNullOrEmpty()) {
                q += " and '$targetFolderId' in parents"
            }

            val fields = URLEncoder.encode("files(id, name, mimeType, size, thumbnailLink)", "UTF-8")
            val encodedQ = URLEncoder.encode(q, "UTF-8")
            val urlString = "$apiBase/files?q=$encodedQ&fields=$fields&pageSize=100&orderBy=modifiedTime desc"

            val url = URL(urlString)
            val conn = url.openConnection() as HttpURLConnection
            conn.requestMethod = "GET"
            conn.setRequestProperty("Authorization", "Bearer $accessToken")
            conn.connectTimeout = 15000
            conn.readTimeout = 15000

            if (conn.responseCode == 200) {
                val reader = BufferedReader(InputStreamReader(conn.inputStream))
                val response = reader.readText()
                reader.close()

                val json = JSONObject(response)
                val filesArray = json.optJSONArray("files") ?: return@withContext emptyList()
                for (i in 0 until filesArray.length()) {
                    val item = filesArray.getJSONObject(i)
                    fileList.add(
                        DriveFile(
                            id = item.getString("id"),
                            name = item.getString("name"),
                            mimeType = item.optString("mimeType"),
                            size = if (item.has("size")) item.getLong("size") else null,
                            thumbnailLink = item.optString("thumbnailLink", null)
                        )
                    )
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
        return@withContext fileList
    }
}
