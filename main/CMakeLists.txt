idf_component_register(SRCS "armdeck_main.c"
                            "esp_hidd_prf_api.c"
                            "hid_dev.c"
                            "hid_device_le_prf.c"
                       INCLUDE_DIRS "."
                       REQUIRES bt armdeck_service button_matrix nvs_flash)

target_compile_options(${COMPONENT_LIB} PRIVATE -Wno-unused-const-variable)