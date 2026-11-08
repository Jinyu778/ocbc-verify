package sg.safebank.callstate

import android.Manifest
import android.content.Context
import android.os.Build
import android.telephony.PhoneStateListener
import android.telephony.TelephonyCallback
import android.telephony.TelephonyManager
import android.view.WindowManager
import androidx.annotation.RequiresApi
import com.getcapacitor.JSObject
import com.getcapacitor.PermissionState
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback
import java.util.concurrent.Executors
import java.util.function.Consumer

/**
 * Reports ONLY call STATE: idle / ringing / off-hook, plus when the last call ended.
 * It never reads the phone number, contacts, call audio or any message content.
 * (TelephonyCallback.CallStateListener does not receive the number at all.)
 */
@CapacitorPlugin(
    name = "CallState",
    permissions = [Permission(strings = [Manifest.permission.READ_PHONE_STATE], alias = "phone")]
)
class CallStatePlugin : Plugin() {
    private var onCall = false
    private var lastCallEndedAt: Long? = null
    private var screenShared: Boolean? = null
    private var listening = false
    private var telephonyCallback: Any? = null
    private var legacyListener: PhoneStateListener? = null
    private var screenRecordingCallback: Any? = null

    override fun load() {
        if (getPermissionState("phone") == PermissionState.GRANTED) startListening()
        startScreenRecordingDetection()
    }

    @PluginMethod
    override fun checkPermissions(call: PluginCall) {
        call.resolve(JSObject().put("phone", getPermissionState("phone").toString()))
    }

    @PluginMethod
    override fun requestPermissions(call: PluginCall) {
        if (getPermissionState("phone") == PermissionState.GRANTED) {
            startListening()
            call.resolve(JSObject().put("phone", "granted"))
        } else {
            requestPermissionForAlias("phone", call, "onPermissionResult")
        }
    }

    @PermissionCallback
    private fun onPermissionResult(call: PluginCall) {
        val state = getPermissionState("phone")
        if (state == PermissionState.GRANTED) startListening()
        call.resolve(JSObject().put("phone", state.toString()))
    }

    @PluginMethod
    fun getCallState(call: PluginCall) {
        if (getPermissionState("phone") != PermissionState.GRANTED) {
            call.reject("permission_denied")
            return
        }
        startListening()
        call.resolve(snapshot())
    }

    private fun snapshot(): JSObject = JSObject().apply {
        put("onCall", onCall)
        put("lastCallEndedAt", lastCallEndedAt)
        put("screenShared", screenShared)
    }

    private fun onState(state: Int) {
        val nowOnCall = state == TelephonyManager.CALL_STATE_OFFHOOK || state == TelephonyManager.CALL_STATE_RINGING
        if (onCall && !nowOnCall) lastCallEndedAt = System.currentTimeMillis()
        onCall = nowOnCall
        notifyListeners("callStateChange", snapshot())
    }

    private fun startListening() {
        if (listening) return
        val tm = context.getSystemService(Context.TELEPHONY_SERVICE) as? TelephonyManager ?: return
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val cb = Api31Callback { onState(it) }
                tm.registerTelephonyCallback(Executors.newSingleThreadExecutor(), cb)
                telephonyCallback = cb
            } else {
                @Suppress("DEPRECATION")
                val l = object : PhoneStateListener() {
                    @Deprecated("Deprecated in Java")
                    override fun onCallStateChanged(state: Int, phoneNumber: String?) {
                        // phoneNumber is deliberately ignored and never stored or sent.
                        onState(state)
                    }
                }
                @Suppress("DEPRECATION")
                tm.listen(l, PhoneStateListener.LISTEN_CALL_STATE)
                legacyListener = l
            }
            listening = true
        } catch (e: SecurityException) {
            listening = false
        }
    }

    private fun startScreenRecordingDetection() {
        if (Build.VERSION.SDK_INT < 35) return
        try {
            val wm = activity.getSystemService(WindowManager::class.java)
            val cb = Consumer<Int> { state ->
                screenShared = state == WindowManager.SCREEN_RECORDING_STATE_VISIBLE
                notifyListeners("callStateChange", snapshot())
            }
            val initial = wm.addScreenRecordingCallback(activity.mainExecutor, cb)
            screenShared = initial == WindowManager.SCREEN_RECORDING_STATE_VISIBLE
            screenRecordingCallback = cb
        } catch (e: Exception) {
            screenShared = null
        }
    }

    override fun handleOnDestroy() {
        val tm = context.getSystemService(Context.TELEPHONY_SERVICE) as? TelephonyManager
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            (telephonyCallback as? TelephonyCallback)?.let { tm?.unregisterTelephonyCallback(it) }
        } else {
            @Suppress("DEPRECATION")
            legacyListener?.let { tm?.listen(it, PhoneStateListener.LISTEN_NONE) }
        }
        super.handleOnDestroy()
    }

    @RequiresApi(Build.VERSION_CODES.S)
    private class Api31Callback(val handler: (Int) -> Unit) : TelephonyCallback(), TelephonyCallback.CallStateListener {
        override fun onCallStateChanged(state: Int) = handler(state)
    }
}
