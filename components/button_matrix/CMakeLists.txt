idf_component_register(SRCS "button_matrix.c"
                       INCLUDE_DIRS "include"
                       REQUIRES driver esp_timer
                       PRIV_REQUIRES armdeck_service)

# Ajouter cette option pour éviter les avertissements d'erreur de format
target_compile_options(${COMPONENT_LIB} PRIVATE -Wno-format)