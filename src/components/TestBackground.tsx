import XPBackground  from "../../public/window_xp.jpg";
import CRTSceneR3F from "./CRTShaderScene";

const TestBackground = () => {
    return <div style={{ backgroundImage: `url(${XPBackground})`, backgroundSize: 'cover', backgroundRepeat: 'no-repeat', width: '100vw', height: '100vh' }}></div>;
};

export default TestBackground;