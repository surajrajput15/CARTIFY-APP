import { GoogleLogin } from '@react-oauth/google';
import { googleLogin } from '../../services/authApi';

const GoogleLoginButton = ({ login, navigate, setError }) => {
  return (
    <div className="mt-8 flex flex-col items-center border-t border-gray-200 pt-6 animate-fade-in-up">
      <p className="text-sm text-gray-500 mb-4 font-medium">Or continue with</p>
      <GoogleLogin
        onSuccess={async (credentialResponse) => {
          try {
            console.log("[DEBUG-login] Google response:", credentialResponse);
            console.log("[DEBUG-login] Credential:", credentialResponse?.credential);
            const credential = credentialResponse?.credential;
            if (!credential) {
              console.error("[DEBUG-login] NO credential — popup aborted / study result not delivered:", credentialResponse);
              setError('Google sign-in was blocked. Please try again, allow the popup, and disable ad-block.');
              return;
            }
            console.log("[DEBUG-login] Payload being sent:", { credential });
            const response = await googleLogin({ credential });
            console.log("[DEBUG-login] googleLogin response:", response?.status, response?.data);
            login(response.data.user, response.data.token);
            navigate('/');
          } catch (err) {
            console.error("[DEBUG-login] Google Login Error:", err);
            setError('Google login failed. Please try again.');
          }
        }}
        onError={() => {
          setError('Google login was not completed.');
        }}
        shape="pill"
        theme="outline"
      />
    </div>
  );
};

export default GoogleLoginButton;
