# StreamDeck-BLE

Application de configuration pour StreamDeck-BLE, un contrôleur à 12 touches basé sur ESP32-S3.

## Présentation du projet

StreamDeck-BLE est une application qui permet de configurer les touches d'un StreamDeck, un périphérique matériel à 12 boutons programmables disposés en grille 4x3. Cette application vous permet de personnaliser chaque touche et de communiquer avec l'appareil via Bluetooth Low Energy (BLE).

## Fonctionnalités principales

- **Grille de touches**: Configuration visuelle des 12 touches (4x3) avec fonction glisser-déposer pour réaffecter les touches
- **Connexion Bluetooth**: Connexion directe à l'appareil StreamDeck via BLE
- **Suivi de batterie**: Visualisation du niveau de batterie de votre appareil en temps réel
- **Mises à jour OTA**: Envoi de mises à jour du firmware par fragments de 20 octets avec suivi de progression
- **Import/Export**: Sauvegarde et chargement des configurations de touches

## Technologies utilisées

- **Frontend**: 
  - React pour l'interface utilisateur
  - TypeScript pour un développement robuste et typé
  - Vite comme bundler et serveur de développement
  - SCSS pour les styles avancés
- **Communication BLE**: API Web Bluetooth pour la connectivité sans fil
- **PWA (Progressive Web App)**: Pour une utilisation directe depuis le navigateur

## Structure du projet

```
streamdeck-web/
├── pwa/               # Application web (Vite + React + TypeScript + Sass)
│   ├── src/
│   │   ├── components/     # Composants React (KeyGrid, MacroList, etc.)
│   │   ├── ble/           # Logique de communication Bluetooth
│   │   ├── hooks/         # Hooks React personnalisés
│   │   └── styles/        # Styles SCSS
│   └── vite.config.ts
└── README.md
```

## Protocole de communication

La communication avec le StreamDeck se fait via Bluetooth Low Energy (BLE) selon le protocole suivant:

1. **Établissement de connexion**:
   - L'application recherche les appareils BLE compatibles
   - Elle se connecte au service spécifique du StreamDeck (identifié par son UUID)
   - Les caractéristiques pour la lecture/écriture sont découvertes

2. **Commandes principales**:
   - Lecture du niveau de batterie
   - Transfert des configurations de touches
   - Envoi de commandes de contrôle
   - Mise à jour du firmware par fragments

3. **Format des données**:
   - Les commandes sont transmises sous forme de tableaux d'octets
   - Les messages sont divisés en paquets de 20 octets maximum (limitation BLE)
   - Un système d'accusé de réception assure l'intégrité des transferts

## Utilisation

### Application Web (PWA)

1. Installation des dépendances:

```bash
cd pwa
npm install
```

2. Démarrage du serveur de développement:

```bash
npm run dev
```

3. Compilation pour production:

```bash
npm run build
```

L'application compilée sera disponible dans le répertoire `pwa/dist`.

## Déploiement de la PWA

Pour déployer l'application sur un serveur web:

1. Construire l'application:

```bash
cd pwa
npm run build
```

2. Télécharger le contenu du répertoire `pwa/dist` sur votre serveur web.

3. Assurez-vous que votre serveur web est configuré pour servir le fichier `index.html` pour toutes les routes.

## Contribution

Les contributions sont les bienvenues! Vous pouvez contribuer au projet en:

- Signalant des bugs
- Proposant des améliorations
- Soumettant des pull requests
