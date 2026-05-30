package io.github.ziyuezhou1.voicecalendar;

import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.speech.RecognizerIntent;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import androidx.activity.result.ActivityResult;
import java.util.ArrayList;

@CapacitorPlugin(name = "IntentSpeech")
public class IntentSpeechPlugin extends Plugin {

    @PluginMethod
    public void available(PluginCall call) {
        JSObject result = new JSObject();
        result.put("available", canResolveSpeechIntent());
        call.resolve(result);
    }

    @PluginMethod
    public void start(PluginCall call) {
        Intent intent = createSpeechIntent(call);
        PackageManager packageManager = getActivity().getPackageManager();
        if (intent.resolveActivity(packageManager) == null) {
            call.unavailable("No speech recognition activity is available");
            return;
        }

        startActivityForResult(call, intent, "speechResult");
    }

    @ActivityCallback
    private void speechResult(PluginCall call, ActivityResult result) {
        if (call == null) return;

        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
            call.reject("Speech recognition was cancelled", "intent-cancelled");
            return;
        }

        ArrayList<String> matches = result.getData().getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS);
        JSObject response = new JSObject();
        response.put("matches", new JSArray(matches == null ? new ArrayList<String>() : matches));
        call.resolve(response);
    }

    private boolean canResolveSpeechIntent() {
        Intent intent = createSpeechIntent(null);
        return intent.resolveActivity(getActivity().getPackageManager()) != null;
    }

    private Intent createSpeechIntent(PluginCall call) {
        String language = call == null ? "zh-CN" : call.getString("language", "zh-CN");
        int maxResults = call == null ? 1 : call.getInt("maxResults", 1);
        String prompt = call == null ? "请说出日程命令" : call.getString("prompt", "请说出日程命令");

        Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, language);
        intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, maxResults);
        intent.putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, getActivity().getPackageName());
        intent.putExtra(RecognizerIntent.EXTRA_PROMPT, prompt);
        return intent;
    }
}
