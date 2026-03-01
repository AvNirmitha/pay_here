module.exports = {
    // got to /be folder path
    apps: [
        {
            name: "payhere_be",
            script: "npm",
            interpreter: "none",
            args: "start",
            cwd: "./server",  // Backend folder path
            watch: false,
            env: {
                env_file: ".env"
            }
        }
    ],
}