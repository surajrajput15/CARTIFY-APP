import { GoogleLogin } from '@react-oauth/google';
import { googleLogin } from '../../services/authApi';

const GoogleLoginButton = ({ login, navigate, setError }) => {
  return (
    <div className="mt-8 flex flex-col items-center border-t border-gray-200 pt-6 animate-fade-in-up">
      <p className="text-sm text-gray-500 mb-4 font-medium">Or continue with</p>
      <GoogleLogin
        onSuccess={async (credentialResponse) => {
          try {
            // Send the original Google credential (ID Token) to the backend
            // for server-side verification. We do NOT decode/trust it locally.
            const response = await googleLogin({
              credential: credentialResponse.credential
            });
            login(response.data.user, response.data.token);
            navigate('/');
          } catch (err) {
            console.error("Google Login Error:", err);
            setError('Google login failed. Please try again.');
          }
        }}
        onError={() => {
          setError('Google login was not completed.');
        }}
        useOneTap
        shape="pill"
        theme="outline"
      />
    </div>
  );
};

export default GoogleLoginButton;
