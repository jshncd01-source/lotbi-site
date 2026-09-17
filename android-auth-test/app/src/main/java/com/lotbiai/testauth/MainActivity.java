package com.lotbiai.testauth;

import android.app.Activity;
import android.graphics.Color;
import android.os.Bundle;
import android.os.CancellationSignal;
import android.text.InputType;
import android.view.Gravity;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

import androidx.credentials.CreateCredentialResponse;
import androidx.credentials.CreatePublicKeyCredentialRequest;
import androidx.credentials.CreatePublicKeyCredentialResponse;
import androidx.credentials.Credential;
import androidx.credentials.CredentialManager;
import androidx.credentials.CredentialManagerCallback;
import androidx.credentials.GetCredentialRequest;
import androidx.credentials.GetCredentialResponse;
import androidx.credentials.GetPublicKeyCredentialOption;
import androidx.credentials.PublicKeyCredential;
import androidx.credentials.exceptions.CreateCredentialException;
import androidx.credentials.exceptions.GetCredentialException;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import javax.net.ssl.HttpsURLConnection;

public final class MainActivity extends Activity {
    private static final String API = "https://api.lotbiai.com";
    private static final String PREFS = "lotbi_auth_test";
    private static final String PLATFORM = "ANDROID";
    private static final String INSTALLATION_LABEL = "LOTBI Android auth test";

    private final ExecutorService io = Executors.newSingleThreadExecutor();
    private CredentialManager credentialManager;

    private EditText nameInput;
    private EditText handleInput;
    private Button signupButton;
    private Button loginButton;
    private Button verifyButton;
    private Button logoutButton;
    private TextView status;
    private TextView sessionView;

    private String enrollmentToken;
    private String enrollmentChallengeId;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        credentialManager = CredentialManager.create(this);
        setContentView(buildUi());
        restoreLocalSession();
    }

    private View buildUi() {
        int pad = dp(22);
        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true);

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(pad, dp(32), pad, dp(32));
        root.setBackgroundColor(Color.WHITE);
        scroll.addView(root, new ScrollView.LayoutParams(
                ScrollView.LayoutParams.MATCH_PARENT,
                ScrollView.LayoutParams.WRAP_CONTENT));

        TextView brand = text("LOTBI", 28, true, Color.rgb(24, 42, 70));
        root.addView(brand);

        TextView title = text("회원가입 · 기본 로그인 실기기 테스트", 21, true, Color.rgb(23, 25, 29));
        LinearLayout.LayoutParams titleLp = lp();
        titleLp.topMargin = dp(12);
        root.addView(title, titleLp);

        TextView warning = text(
                "테스트 전용 앱입니다. Production Core 인증만 검증하며 결제·구매 기능은 포함하지 않습니다.",
                13, false, Color.rgb(140, 53, 38));
        LinearLayout.LayoutParams warningLp = lp();
        warningLp.topMargin = dp(10);
        root.addView(warning, warningLp);

        status = text("준비됨", 14, true, Color.rgb(53, 58, 66));
        LinearLayout.LayoutParams statusLp = lp();
        statusLp.topMargin = dp(18);
        status.setPadding(dp(12), dp(12), dp(12), dp(12));
        status.setBackgroundColor(Color.rgb(247, 248, 250));
        root.addView(status, statusLp);

        root.addView(label("이름"));
        nameInput = input("테스트 사용자", false);
        root.addView(nameInput, lp());

        root.addView(label("아이디"));
        handleInput = input("3자 이상", true);
        root.addView(handleInput, lp());

        signupButton = button("회원가입 + 패스키 설정");
        signupButton.setOnClickListener(v -> startSignup());
        root.addView(signupButton, buttonLp());

        loginButton = button("패스키 로그인");
        loginButton.setOnClickListener(v -> startLogin());
        root.addView(loginButton, buttonLp());

        verifyButton = button("현재 세션 확인");
        verifyButton.setOnClickListener(v -> verifyStoredSession());
        root.addView(verifyButton, buttonLp());

        logoutButton = button("이 기기의 테스트 세션 삭제");
        logoutButton.setOnClickListener(v -> logoutLocal());
        root.addView(logoutButton, buttonLp());

        sessionView = text("로그인된 세션 없음", 14, false, Color.rgb(53, 58, 66));
        sessionView.setPadding(dp(12), dp(12), dp(12), dp(12));
        sessionView.setBackgroundColor(Color.rgb(247, 248, 250));
        LinearLayout.LayoutParams sessionLp = lp();
        sessionLp.topMargin = dp(18);
        root.addView(sessionView, sessionLp);

        TextView help = text(
                "회원가입: 이름과 아이디 입력 → 계정 생성 → 휴대폰 잠금/지문/얼굴 인증으로 패스키 생성 → FULL 세션 확인\n\n로그인: 아이디 입력 → 저장된 패스키 선택 → FULL 세션 확인",
                13, false, Color.rgb(98, 104, 116));
        LinearLayout.LayoutParams helpLp = lp();
        helpLp.topMargin = dp(16);
        root.addView(help, helpLp);
        return scroll;
    }

    private void startSignup() {
        String name = nameInput.getText().toString().trim();
        String handle = handleInput.getText().toString().trim();
        if (name.isEmpty() || handle.length() < 3) {
            showError("이름과 3자 이상의 아이디를 입력해 주세요.");
            return;
        }
        setBusy(true, "Production Core에 계정을 만들고 있어요…");
        io.execute(() -> {
            try {
                JSONObject body = new JSONObject()
                        .put("name", name)
                        .put("account_handle", handle)
                        .put("installation_label", INSTALLATION_LABEL)
                        .put("platform", PLATFORM);
                JSONObject created = request("POST", "/v2/accounts", null, body);
                enrollmentToken = created.getString("session_token");
                JSONObject options = request("POST", "/v2/passkeys/register/options", enrollmentToken, null);
                enrollmentChallengeId = options.getString("challenge_id");
                String publicKeyJson = options.getJSONObject("publicKey").toString();
                runOnUiThread(() -> launchPasskeyCreation(publicKeyJson, handle));
            } catch (Exception e) {
                showErrorFromAnyThread(e);
            }
        });
    }

    private void launchPasskeyCreation(String publicKeyJson, String handle) {
        try {
            CreatePublicKeyCredentialRequest request =
                    new CreatePublicKeyCredentialRequest(publicKeyJson, null, false, null, null, false);
            credentialManager.createCredentialAsync(
                    this,
                    request,
                    new CancellationSignal(),
                    getMainExecutor(),
                    new CredentialManagerCallback<CreateCredentialResponse, CreateCredentialException>() {
                        @Override
                        public void onResult(CreateCredentialResponse result) {
                            if (!(result instanceof CreatePublicKeyCredentialResponse)) {
                                showError("패스키 생성 응답 형식이 올바르지 않습니다.");
                                return;
                            }
                            String credentialJson =
                                    ((CreatePublicKeyCredentialResponse) result).getRegistrationResponseJson();
                            finishEnrollment(credentialJson, handle);
                        }

                        @Override
                        public void onError(CreateCredentialException error) {
                            showError("패스키 생성이 완료되지 않았습니다: " + safeMessage(error));
                        }
                    });
        } catch (Exception e) {
            showError("패스키 생성 요청을 시작하지 못했습니다: " + safeMessage(e));
        }
    }

    private void finishEnrollment(String credentialJson, String handle) {
        setBusy(true, "패스키를 LOTBI 계정에 등록하고 있어요…");
        io.execute(() -> {
            try {
                JSONObject body = new JSONObject()
                        .put("challenge_id", enrollmentChallengeId)
                        .put("credential", new JSONObject(credentialJson));
                JSONObject result = request("POST", "/v2/passkeys/register/finish", enrollmentToken, body);
                String assurance = result.optString("assurance_level", "");
                String replacementToken = result.optString("session_token", "");
                if (!"FULL".equals(assurance) || replacementToken.isEmpty()) {
                    throw new IllegalStateException("Core가 FULL 교체 세션을 반환하지 않았습니다.");
                }
                saveSession(replacementToken, handle);
                JSONObject me = request("GET", "/v2/me", replacementToken, null);
                showFullSession(me, "회원가입 완료");
            } catch (Exception e) {
                showErrorFromAnyThread(e);
            } finally {
                enrollmentToken = null;
                enrollmentChallengeId = null;
            }
        });
    }

    private void startLogin() {
        String handle = handleInput.getText().toString().trim();
        if (handle.length() < 3) {
            showError("로그인할 아이디를 3자 이상 입력해 주세요.");
            return;
        }
        setBusy(true, "로그인용 패스키 정보를 요청하고 있어요…");
        io.execute(() -> {
            try {
                JSONObject body = new JSONObject()
                        .put("account_handle", handle)
                        .put("installation_label", INSTALLATION_LABEL)
                        .put("platform", PLATFORM);
                JSONObject options = request("POST", "/v2/sessions/passkey/options", null, body);
                String challengeId = options.getString("challenge_id");
                String publicKeyJson = options.getJSONObject("publicKey").toString();
                runOnUiThread(() -> launchPasskeyLogin(publicKeyJson, challengeId, handle));
            } catch (Exception e) {
                showErrorFromAnyThread(e);
            }
        });
    }

    private void launchPasskeyLogin(String publicKeyJson, String challengeId, String handle) {
        try {
            GetPublicKeyCredentialOption option =
                    new GetPublicKeyCredentialOption(publicKeyJson, null, Collections.emptySet());
            GetCredentialRequest request = new GetCredentialRequest.Builder()
                    .addCredentialOption(option)
                    .build();
            credentialManager.getCredentialAsync(
                    this,
                    request,
                    new CancellationSignal(),
                    getMainExecutor(),
                    new CredentialManagerCallback<GetCredentialResponse, GetCredentialException>() {
                        @Override
                        public void onResult(GetCredentialResponse result) {
                            Credential credential = result.getCredential();
                            if (!(credential instanceof PublicKeyCredential)) {
                                showError("패스키 로그인 응답 형식이 올바르지 않습니다.");
                                return;
                            }
                            String credentialJson =
                                    ((PublicKeyCredential) credential).getAuthenticationResponseJson();
                            finishLogin(challengeId, credentialJson, handle);
                        }

                        @Override
                        public void onError(GetCredentialException error) {
                            showError("패스키 로그인이 완료되지 않았습니다: " + safeMessage(error));
                        }
                    });
        } catch (Exception e) {
            showError("패스키 로그인 요청을 시작하지 못했습니다: " + safeMessage(e));
        }
    }

    private void finishLogin(String challengeId, String credentialJson, String handle) {
        setBusy(true, "Production Core에서 로그인 세션을 확인하고 있어요…");
        io.execute(() -> {
            try {
                JSONObject body = new JSONObject()
                        .put("challenge_id", challengeId)
                        .put("credential", new JSONObject(credentialJson));
                JSONObject session = request("POST", "/v2/sessions/passkey/finish", null, body);
                if (!"FULL".equals(session.optString("assurance_level", ""))) {
                    throw new IllegalStateException("FULL 세션이 반환되지 않았습니다.");
                }
                String token = session.getString("session_token");
                saveSession(token, handle);
                JSONObject me = request("GET", "/v2/me", token, null);
                showFullSession(me, "로그인 완료");
            } catch (Exception e) {
                showErrorFromAnyThread(e);
            }
        });
    }

    private void restoreLocalSession() {
        String token = getPreferences().getString("session_token", "");
        String handle = getPreferences().getString("account_handle", "");
        if (!handle.isEmpty()) handleInput.setText(handle);
        if (token.isEmpty()) {
            sessionView.setText("로그인된 세션 없음");
            return;
        }
        setBusy(true, "저장된 테스트 세션을 확인하고 있어요…");
        io.execute(() -> {
            try {
                JSONObject me = request("GET", "/v2/me", token, null);
                showFullSession(me, "저장된 세션 복원 완료");
            } catch (Exception e) {
                getPreferences().edit().clear().apply();
                showErrorFromAnyThread(new IllegalStateException("저장된 세션이 만료되었거나 유효하지 않습니다."));
            }
        });
    }

    private void verifyStoredSession() {
        String token = getPreferences().getString("session_token", "");
        if (token.isEmpty()) {
            showError("확인할 로그인 세션이 없습니다.");
            return;
        }
        setBusy(true, "현재 세션을 Production Core에서 검증하고 있어요…");
        io.execute(() -> {
            try {
                JSONObject me = request("GET", "/v2/me", token, null);
                showFullSession(me, "세션 검증 성공");
            } catch (Exception e) {
                showErrorFromAnyThread(e);
            }
        });
    }

    private void logoutLocal() {
        getPreferences().edit().clear().apply();
        sessionView.setText("로그인된 세션 없음");
        status.setText("이 기기의 테스트 세션을 삭제했습니다.");
        setBusy(false, null);
    }

    private JSONObject request(String method, String path, String token, JSONObject body) throws Exception {
        HttpsURLConnection connection = (HttpsURLConnection) new URL(API + path).openConnection();
        connection.setRequestMethod(method);
        connection.setConnectTimeout(15000);
        connection.setReadTimeout(20000);
        connection.setRequestProperty("Accept", "application/json");
        if (token != null && !token.isEmpty()) {
            connection.setRequestProperty("Authorization", "Bearer " + token);
        }
        if (body != null) {
            connection.setDoOutput(true);
            connection.setRequestProperty("Content-Type", "application/json");
            byte[] bytes = body.toString().getBytes(StandardCharsets.UTF_8);
            connection.getOutputStream().write(bytes);
        }

        int code = connection.getResponseCode();
        InputStream input = code >= 200 && code < 300
                ? connection.getInputStream()
                : connection.getErrorStream();
        String responseText = readAll(input);
        JSONObject payload = responseText.isEmpty() ? new JSONObject() : new JSONObject(responseText);
        connection.disconnect();

        if (code < 200 || code >= 300) {
            String message = "HTTP " + code;
            JSONObject detail = payload.optJSONObject("detail");
            if (detail != null) {
                message = detail.optString("message", detail.optString("code", message));
            } else {
                message = payload.optString("message", message);
            }
            throw new IllegalStateException(message);
        }
        return payload;
    }

    private String readAll(InputStream input) throws Exception {
        if (input == null) return "";
        try (InputStream stream = input; ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[4096];
            int count;
            while ((count = stream.read(buffer)) >= 0) {
                out.write(buffer, 0, count);
            }
            return out.toString(StandardCharsets.UTF_8.name());
        }
    }

    private void saveSession(String token, String handle) {
        getPreferences().edit()
                .putString("session_token", token)
                .putString("account_handle", handle)
                .apply();
    }

    private android.content.SharedPreferences getPreferences() {
        return getSharedPreferences(PREFS, MODE_PRIVATE);
    }

    private void showFullSession(JSONObject me, String headline) {
        runOnUiThread(() -> {
            JSONObject user = me.optJSONObject("user");
            JSONObject session = me.optJSONObject("session");
            String name = user == null ? "" : user.optString("name", "");
            String handle = user == null ? "" : user.optString("account_handle", "");
            String assurance = session == null ? "" : session.optString("assurance_level", "");
            sessionView.setText(
                    headline + "\n\n이름: " + name +
                    "\n아이디: " + handle +
                    "\n보증 수준: " + assurance +
                    "\nCore: " + API);
            status.setText("FULL".equals(assurance)
                    ? "✅ Production Core FULL 인증 성공"
                    : "⚠ 인증 수준 확인 필요: " + assurance);
            setBusy(false, null);
        });
    }

    private void showErrorFromAnyThread(Exception error) {
        runOnUiThread(() -> showError(safeMessage(error)));
    }

    private void showError(String message) {
        status.setText("❌ " + message);
        setBusy(false, null);
    }

    private String safeMessage(Throwable error) {
        String message = error.getMessage();
        return message == null || message.trim().isEmpty()
                ? error.getClass().getSimpleName()
                : message;
    }

    private void setBusy(boolean busy, String message) {
        runOnUiThread(() -> {
            signupButton.setEnabled(!busy);
            loginButton.setEnabled(!busy);
            verifyButton.setEnabled(!busy);
            logoutButton.setEnabled(!busy);
            if (message != null) status.setText(message);
        });
    }

    private TextView label(String value) {
        TextView view = text(value, 14, true, Color.rgb(41, 45, 51));
        LinearLayout.LayoutParams p = lp();
        p.topMargin = dp(16);
        view.setLayoutParams(p);
        return view;
    }

    private EditText input(String hint, boolean accountHandle) {
        EditText edit = new EditText(this);
        edit.setHint(hint);
        edit.setTextSize(16);
        edit.setSingleLine(true);
        edit.setPadding(dp(12), 0, dp(12), 0);
        edit.setBackgroundColor(Color.rgb(247, 248, 250));
        if (accountHandle) {
            edit.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS);
        }
        LinearLayout.LayoutParams p = lp();
        p.height = dp(52);
        p.topMargin = dp(6);
        edit.setLayoutParams(p);
        return edit;
    }

    private Button button(String label) {
        Button button = new Button(this);
        button.setText(label);
        button.setTextSize(15);
        button.setAllCaps(false);
        return button;
    }

    private LinearLayout.LayoutParams buttonLp() {
        LinearLayout.LayoutParams p = lp();
        p.height = dp(52);
        p.topMargin = dp(12);
        return p;
    }

    private TextView text(String value, int sp, boolean bold, int color) {
        TextView view = new TextView(this);
        view.setText(value);
        view.setTextSize(sp);
        view.setTextColor(color);
        if (bold) view.setTypeface(view.getTypeface(), android.graphics.Typeface.BOLD);
        view.setGravity(Gravity.START);
        return view;
    }

    private LinearLayout.LayoutParams lp() {
        return new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT);
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        io.shutdownNow();
    }
}
