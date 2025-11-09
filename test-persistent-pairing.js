const { createPairingSession, getSessionStatus, cleanupSession } = require('./simple-pair');

/**
 * Script de test pour le système de jumelage persistant
 */

async function testPersistentPairing() {
  console.log('🧪 Test du système de jumelage persistant Heinz-md\n');

  // Numéro de test (remplacez par un vrai numéro pour tester)
  const testNumber = '529711221986'; // Numéro d'exemple

  try {
    console.log(`📱 Test avec le numéro: ${testNumber}`);
    console.log('⏳ Création de la session de jumelage...\n');

    // Créer une session de jumelage
    const result = await createPairingSession(testNumber, {
      AUTO_JOIN_GROUP: true,
      AUTO_READ_MESSAGES: true,
      AUTO_PRESENCE: true
    });

    if (result.success) {
      if (result.connected) {
        console.log('✅ Appareil déjà connecté!');
      } else {
        console.log(`🔑 Code de jumelage généré: ${result.code}`);
        console.log(`⏰ Expire dans: ${Math.floor(result.expiresIn / 1000 / 60)} minutes\n`);

        console.log('📋 Instructions:');
        console.log('1. Ouvrez WhatsApp sur votre téléphone');
        console.log('2. Allez dans Paramètres → Appareils liés');
        console.log('3. Appuyez sur "Lier un appareil"');
        console.log('4. Sélectionnez "Lier avec un numéro de téléphone"');
        console.log(`5. Entrez le code: ${result.code}\n`);

        // Surveiller le statut pendant 5 minutes
        console.log('👀 Surveillance du statut (5 minutes)...\n');
        
        let attempts = 0;
        const maxAttempts = 60; // 5 minutes (5 secondes * 60)
        
        const statusInterval = setInterval(() => {
          attempts++;
          const status = getSessionStatus(testNumber);
          
          console.log(`[${attempts}/${maxAttempts}] Status: ${status.status} | Reconnect: ${status.reconnectAttempts} | Uptime: ${status.uptime ? Math.floor(status.uptime / 1000) + 's' : 'N/A'}`);
          
          if (status.status === 'connected') {
            console.log('\n🎉 SUCCÈS! Bot connecté avec succès!');
            console.log(`📊 Informations du bot:`, status.info);
            clearInterval(statusInterval);
            
            // Nettoyer après succès
            setTimeout(async () => {
              await cleanupSession(testNumber);
              console.log('🧹 Session nettoyée');
              process.exit(0);
            }, 5000);
            
          } else if (attempts >= maxAttempts) {
            console.log('\n⏰ Timeout atteint (5 minutes)');
            clearInterval(statusInterval);
            
            // Nettoyer après timeout
            setTimeout(async () => {
              await cleanupSession(testNumber);
              console.log('🧹 Session nettoyée');
              process.exit(1);
            }, 1000);
          }
        }, 5000); // Vérifier toutes les 5 secondes
      }
    } else {
      console.error('❌ Erreur:', result.message);
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Erreur lors du test:', error.message);
    
    // Nettoyer en cas d'erreur
    try {
      await cleanupSession(testNumber);
      console.log('🧹 Session nettoyée après erreur');
    } catch (cleanupError) {
      console.error('❌ Erreur nettoyage:', cleanupError.message);
    }
    
    process.exit(1);
  }
}

// Gestion des signaux pour nettoyer proprement
process.on('SIGINT', async () => {
  console.log('\n⏹️ Arrêt du test...');
  try {
    const { cleanupAllSessions } = require('./simple-pair');
    await cleanupAllSessions();
    console.log('🧹 Toutes les sessions nettoyées');
  } catch (error) {
    console.error('❌ Erreur nettoyage:', error.message);
  }
  process.exit(0);
});

// Démarrer le test
if (require.main === module) {
  // Vérifier si un numéro est fourni en argument
  const args = process.argv.slice(2);
  if (args.length > 0) {
    // Utiliser le numéro fourni en argument
    const customNumber = args[0].replace(/[^0-9]/g, '');
    if (customNumber.length >= 10) {
      console.log(`📱 Utilisation du numéro personnalisé: ${customNumber}`);
      // Modifier le numéro de test
      const { createPairingSession, getSessionStatus, cleanupSession } = require('./simple-pair');
      
      async function testWithCustomNumber() {
        console.log('🧪 Test du système de jumelage persistant Heinz-md\n');
        
        try {
          console.log(`📱 Test avec le numéro: ${customNumber}`);
          console.log('⏳ Création de la session de jumelage...\n');

          const result = await createPairingSession(customNumber, {
            AUTO_JOIN_GROUP: true,
            AUTO_READ_MESSAGES: true,
            AUTO_PRESENCE: true
          });

          if (result.success) {
            if (result.connected) {
              console.log('✅ Appareil déjà connecté!');
            } else {
              console.log(`🔑 Code de jumelage généré: ${result.code}`);
              console.log(`⏰ Expire dans: ${Math.floor(result.expiresIn / 1000 / 60)} minutes\n`);

              console.log('📋 Instructions:');
              console.log('1. Ouvrez WhatsApp sur votre téléphone');
              console.log('2. Allez dans Paramètres → Appareils liés');
              console.log('3. Appuyez sur "Lier un appareil"');
              console.log('4. Sélectionnez "Lier avec un numéro de téléphone"');
              console.log(`5. Entrez le code: ${result.code}\n`);

              console.log('👀 Surveillance du statut...\n');
              
              let attempts = 0;
              const maxAttempts = 60;
              
              const statusInterval = setInterval(() => {
                attempts++;
                const status = getSessionStatus(customNumber);
                
                console.log(`[${attempts}/${maxAttempts}] Status: ${status.status} | Reconnect: ${status.reconnectAttempts}`);
                
                if (status.status === 'connected') {
                  console.log('\n🎉 SUCCÈS! Bot connecté!');
                  clearInterval(statusInterval);
                  
                  setTimeout(async () => {
                    await cleanupSession(customNumber);
                    console.log('🧹 Session nettoyée');
                    process.exit(0);
                  }, 5000);
                  
                } else if (attempts >= maxAttempts) {
                  console.log('\n⏰ Timeout atteint');
                  clearInterval(statusInterval);
                  
                  setTimeout(async () => {
                    await cleanupSession(customNumber);
                    console.log('🧹 Session nettoyée');
                    process.exit(1);
                  }, 1000);
                }
              }, 5000);
            }
          } else {
            console.error('❌ Erreur:', result.message);
            process.exit(1);
          }

        } catch (error) {
          console.error('❌ Erreur lors du test:', error.message);
          process.exit(1);
        }
      }
      
      testWithCustomNumber();
    } else {
      console.error('❌ Numéro invalide. Utilisez un numéro avec au moins 10 chiffres.');
      console.log('Usage: node test-persistent-pairing.js [numéro]');
      console.log('Exemple: node test-persistent-pairing.js 529711221986');
      process.exit(1);
    }
  } else {
    console.log('ℹ️ Aucun numéro fourni, utilisation du numéro par défaut');
    console.log('Usage: node test-persistent-pairing.js [numéro]');
    console.log('Exemple: node test-persistent-pairing.js 529711221986\n');
    testPersistentPairing();
  }
}

module.exports = { testPersistentPairing };
