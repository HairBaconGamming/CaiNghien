fn main() {
<<<<<<< HEAD
    tauri_build::try_build(
        tauri_build::Attributes::new().windows_attributes(
            tauri_build::WindowsAttributes::new().app_manifest(include_str!("app.manifest"))
        )
    )
    .expect("failed to run build script");
=======
    tauri_build::build()
>>>>>>> a698a5e52a114d4a1f1ff5b4fb121c030ed783b6
}
