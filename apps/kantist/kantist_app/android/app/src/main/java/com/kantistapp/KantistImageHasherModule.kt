package com.kantistapp

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise
import java.io.FileInputStream
import java.io.File
import java.security.MessageDigest
import android.media.ExifInterface

class KantistImageHasherModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String {
        return "KantistImageHasher"
    }

    @ReactMethod
    fun writeExif(filePath: String, receiptData: String, promise: Promise) {
        Thread {
            try {
                val cleanPath = filePath.replace("file://", "")
                val exif = ExifInterface(cleanPath)
                exif.setAttribute(ExifInterface.TAG_USER_COMMENT, receiptData)
                exif.saveAttributes()
                
                promise.resolve(cleanPath)
            } catch (e: Exception) {
                promise.reject("EXIF_ERROR", e.message, e)
            }
        }.start()
    }

    @ReactMethod
    fun hashImage(filePath: String, promise: Promise) {
        Thread {
            try {
                val cleanPath = filePath.replace("file://", "")
                val file = File(cleanPath)
                val fis = FileInputStream(file)
                val buffer = fis.readBytes()
                fis.close()

                // Find DQT marker (0xFF 0xDB)
                var dqtIndex = -1
                for (i in 0 until buffer.size - 1) {
                    if (buffer[i] == 0xFF.toByte() && buffer[i + 1] == 0xDB.toByte()) {
                        dqtIndex = i
                        break
                    }
                }

                if (dqtIndex == -1) {
                    promise.reject("INVALID_JPEG", "No DQT marker found")
                    return@Thread
                }

                val digest = MessageDigest.getInstance("SHA-256")
                digest.update(buffer, dqtIndex, buffer.size - dqtIndex)
                val hashBytes = digest.digest()

                val hexString = StringBuilder()
                for (b in hashBytes) {
                    val hex = Integer.toHexString(0xFF and b.toInt())
                    if (hex.length == 1) {
                        hexString.append("0")
                    }
                    hexString.append(hex)
                }

                promise.resolve(hexString.toString())
            } catch (e: Exception) {
                promise.reject("HASH_ERROR", e.message, e)
            }
        }.start()
    }
}
