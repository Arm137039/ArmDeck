idf_component_register(    SRCS 
        "armdeck_main.c"
        "armdeck_ble.c"
        "armdeck_hid.c"
        "armdeck_config.c"
        "button_matrix.c"
        "armdeck_protocol.c"
        "armdeck_service.c"
        "power_button.c"
       
        # HID profile files (from ESP-IDF)
        "esp_hidd_prf_api.c"
        "hid_dev.c"
        "hid_device_le_prf.c"
      INCLUDE_DIRS 
        "."
      REQUIRES 
        bt
        nvs_flash
        driver        esp_timer
        esp_hid
        esp_hw_support
    
    PRIV_REQUIRES
        esp_system
)

# Compiler options
target_compile_options(${COMPONENT_LIB} PRIVATE 
    -Wno-unused-const-variable
    -Wno-format
)

# Optional: Add component-specific compile definitions
target_compile_definitions(${COMPONENT_LIB} PRIVATE
    ARMDECK_VERSION="1.2.0"
    ARMDECK_MAX_BUTTONS=12
)