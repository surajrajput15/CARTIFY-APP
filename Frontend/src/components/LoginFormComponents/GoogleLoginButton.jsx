import { GoogleLogin } from '@react-oauth/google';
import { jwtDecode } from "jwt-decode";
import api from '../../api/axios';

const GoogleLoginButton = ({ login, navigate, setError }) => {
  return (
    <div className="mt-8 flex flex-col items-center border-t border-gray-200 pt-6 animate-fade-in-up">
      <p className="text-sm text-gray-500 mb-4 font-medium">Or continue with</p>
      <GoogleLogin
        onSuccess={async (credentialResponse) => {
          try {
            const decoded = jwtDecode(credentialResponse.credential);
            const response = await api.post('/api/auth/google', {
              name: decoded.name,
              email: decoded.email
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
