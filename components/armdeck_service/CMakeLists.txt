idf_component_register(SRCS "armdeck_config.c" "armdeck_service.c"
                       INCLUDE_DIRS "include"
                       REQUIRES bt esp_hid esp_timer json nvs_flash
                       PRIV_REQUIRES main)

# Ajouter cette option pour éviter les avertissements d'erreur de format
target_compile_options(${COMPONENT_LIB} PRIVATE -Wno-format)