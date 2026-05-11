import { Composition } from "remotion";
import { VltdLaunchVideo } from "./VltdLaunchVideo";

export const RemotionRoot = () => {
  return (
    <Composition
      id="VltdLaunchVideo"
      component={VltdLaunchVideo}
      durationInFrames={960}
      fps={30}
      width={1080}
      height={1920}
    />
  );
};
