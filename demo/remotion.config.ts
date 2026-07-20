import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
Config.setConcurrency(2);
// Headless Chrome flags that help in minimal Linux sandboxes.
Config.setChromiumOpenGlRenderer("angle");

// The bundled Chrome Headless Shell requires glibc 2.35; this sandbox has 2.34.
// Use an older Chrome-for-Testing build (120) that runs on glibc 2.34.
if (process.env.REMOTION_BROWSER_EXECUTABLE) {
  Config.setBrowserExecutable(process.env.REMOTION_BROWSER_EXECUTABLE);
}
