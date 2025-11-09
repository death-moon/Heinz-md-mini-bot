const { createPairingSession, getSessionStatus, cleanupSession } = require('./simple-pair');

/**
 * Script de test pour le système de jumelage persistant
 */

async function testPersistentPairing() {
  console.log('*🧪 ᴛᴇsᴛ ᴅᴜ sʏsᴛᴇ̀ᴍᴇ ᴅᴇ ᴊᴜᴍᴇʟᴀɢᴇ ᴘᴇʀsɪsᴛᴀɴᴛ ʜᴇɪɴᴢ ᴍᴅ*\n');

  // Numéro de test (remplacez par un vrai numéro pour tester)
  const testNumber = '529711221986'; // Numéro d'exemple

  try {
    console.log(`*📱 ᴛᴇsᴛ ᴀᴠᴇᴄ ʟᴇ ɴᴜᴍᴇ́ʀᴏ: ${testNumber}*`);
    console.log('*⏳ ᴄʀᴇ́ᴀᴛɪᴏɴ ᴅᴇ ʟᴀ sᴇssɪᴏɴ ᴅᴇ ᴊᴜᴍᴇʟᴀɢᴇ...*\n');

    // Créer une session de jumelage
    const result = await createPairingSession(testNumber, {
      AUTO_JOIN_GROUP: true,
      AUTO_READ_MESSAGES: true,
      AUTO_PRESENCE: true
    });

    if (result.success) {
      if (result.connected) {
        console.log('*✅ ᴀᴘᴘᴀʀᴇɪʟ ᴅᴇ́ᴊᴀ̀ ᴄᴏɴɴᴇᴄᴛᴇ́!*');
      } else {
        console.log(`*🔑 ᴄᴏᴅᴇ ᴅᴇ ᴊᴜᴍᴇʟᴀɢᴇ ɢᴇ́ɴᴇ́ʀᴇ́: ${result.code}*`);
        console.log(`*⏰ ᴇxᴘɪʀᴇ ᴅᴀɴs: ${Math.floor(result.expiresIn / 1000 / 60)} ᴍɪɴᴜᴛᴇs*\n`);

        console.log('*📋 ɪɴsᴛʀᴜᴄᴛɪᴏɴs:*');
        console.log('*ɪ- ᴏᴜᴠʀᴇᴢ ᴡʜᴀᴛsᴀᴘᴘ sᴜʀ ᴠᴏᴛʀᴇ ᴛᴇ́ʟᴇ́ᴘʜᴏɴᴇ*');
        console.log('*ɪɪ- ᴀʟʟᴇᴢ ᴅᴀɴs ᴘᴀʀᴀᴍᴇ̀ᴛʀᴇs → ᴀᴘᴘᴀʀᴇɪʟs ʟɪᴇ́s*');
        console.log('*ɪɪɪ- ᴀᴘᴘᴜʏᴇᴢ sᴜʀ ʟɪᴇʀ ᴜɴ ᴀᴘᴘᴀʀᴇɪʟ*');
        console.log('*ɪᴠ- sᴇ́ʟᴇᴄᴛɪᴏɴɴᴇᴢ ʟɪᴇʀ ᴀᴠᴇᴄ ᴜɴ ɴᴜᴍᴇ́ʀᴏ ᴅᴇ ᴛᴇ́ʟᴇ́ᴘʜᴏɴᴇ*');
        console.log(`*ᴠ- ᴇɴᴛʀᴇᴢ ʟᴇ ᴄᴏᴅᴇ: ${result.code}*\n`);

        // Surveiller le statut pendant 5 minutes
        console.log('*👀 sᴜʀᴠᴇɪʟʟᴀɴᴄᴇ ᴅᴜ sᴛᴀᴛᴜᴛ (5 ᴍɪɴᴜᴛᴇs)...*\n');
        
        let attempts = 0;
        const maxAttempts = 60; // 5 minutes (5 secondes * 60)
        
        const statusInterval = setInterval(() => {
          attempts++;
          const status = getSessionStatus(testNumber);
          
          console.log(`[${attempts}/${maxAttempts}] sᴛᴀᴛᴜs: ${status.status} | ʀᴇᴄᴏɴɴᴇᴄᴛ: ${status.reconnectAttempts} | ᴜᴘᴛɪᴍᴇ: ${status.uptime ? Math.floor(status.uptime / 1000) + 's' : 'N/A'}`);
          
          if (status.status === 'ᴄᴏɴɴᴇᴄᴛᴇᴅ') {
            console.log('\n*🎉 sᴜᴄᴄᴇ̀s! ʙᴏᴛ ᴄᴏɴɴᴇᴄᴛᴇ́ ᴀᴠᴇᴄ sᴜᴄᴄᴇ̀s!*');
            console.log(`*📊 ɪɴғᴏʀᴍᴀᴛɪᴏɴs ᴅᴜ ʙᴏᴛ:*`, status.info);
            clearInterval(statusInterval);
            
            // Nettoyer après succès
            setTimeout(async () => {
              await cleanupSession(testNumber);
              console.log('*🧹 sᴇssɪᴏɴ ɴᴇᴛᴛᴏʏᴇ́ᴇ*');
              process.exit(0);
            }, 5000);
            
          } else if (attempts >= maxAttempts) {
            console.log('\n*⏰ ᴛɪᴍᴇᴏᴜᴛ ᴀᴛᴛᴇɪɴᴛ (5 ᴍɪɴᴜᴛᴇs)*');
            clearInterval(statusInterval);
            
            // Nettoyer après timeout
            setTimeout(async () => {
              await cleanupSession(testNumber);
              console.log('*🧹 sᴇssɪᴏɴ ɴᴇᴛᴛᴏʏᴇ́ᴇ*');
              process.exit(1);
            }, 1000);
          }
        }, 5000); // Vérifier toutes les 5 secondes
      }
    } else {
      console.error('*❌ ᴇʀʀᴇᴜʀ:*', result.message);
      process.exit(1);
    }

  } catch (error) {
    console.error('*❌ ᴇʀʀᴇᴜʀ ʟᴏʀs ᴅᴜ ᴛᴇsᴛ:*', error.message);
    
    // Nettoyer en cas d'erreur
    try {
      await cleanupSession(testNumber);
      console.log('*🧹 sᴇssɪᴏɴ ɴᴇᴛᴛᴏʏᴇ́ᴇ ᴀᴘʀᴇ̀s ᴇʀʀᴇᴜʀ*');
    } catch (cleanupError) {
      console.error('*❌ ᴇʀʀᴇᴜʀ ɴᴇᴛᴛᴏʏᴀɢᴇ:*', cleanupError.message);
    }
    
    process.exit(1);
  }
}

// Gestion des signaux pour nettoyer proprement
process.on('SIGINT', async () => {
  console.log('\n*⏹️ ᴀʀʀᴇ̂ᴛ ᴅᴜ ᴛᴇsᴛ...*');
  try {
    const { cleanupAllSessions } = require('./simple-pair');
    await cleanupAllSessions();
    console.log('*🧹 ᴛᴏᴜᴛᴇs ʟᴇs sᴇssɪᴏɴs ɴᴇᴛᴛᴏʏᴇ́ᴇs*');
  } catch (error) {
    console.error('*❌ ᴇʀʀᴇᴜʀ ɴᴇᴛᴛᴏʏᴀɢᴇ:*', error.message);
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
      console.log(`*📱 ᴜᴛɪʟɪsᴀᴛɪᴏɴ ᴅᴜ ɴᴜᴍᴇ́ʀᴏ ᴘᴇʀsᴏɴɴᴀʟɪsᴇ́: ${customNumber}*`);
      // Modifier le numéro de test
      const { createPairingSession, getSessionStatus, cleanupSession } = require('./simple-pair');
      
      async function testWithCustomNumber() {
        console.log('*🧪 ᴛᴇsᴛ ᴅᴜ sʏsᴛᴇ̀ᴍᴇ ᴅᴇ ᴊᴜᴍᴇʟᴀɢᴇ ᴘᴇʀsɪsᴛᴀɴᴛ ʜᴇɪɴᴢ-ᴍᴅ*\n');
        
        try {
          console.log(`*📱 ᴛᴇsᴛ ᴀᴠᴇᴄ ʟᴇ ɴᴜᴍᴇ́ʀᴏ: ${customNumber}*`);
          console.log('*⏳ ᴄʀᴇ́ᴀᴛɪᴏɴ ᴅᴇ ʟᴀ sᴇssɪᴏɴ ᴅᴇ ᴊᴜᴍᴇʟᴀɢᴇ...*\n');

          const result = await createPairingSession(customNumber, {
            AUTO_JOIN_GROUP: true,
            AUTO_READ_MESSAGES: true,
            AUTO_PRESENCE: true
          });

          if (result.success) {
            if (result.connected) {
              console.log('*✅ ᴀᴘᴘᴀʀᴇɪʟ ᴅᴇ́ᴊᴀ̀ ᴄᴏɴɴᴇᴄᴛᴇ́!*');
            } else {
              console.log(`*🔑 ᴄᴏᴅᴇ ᴅᴇ ᴊᴜᴍᴇʟᴀɢᴇ ɢᴇ́ɴᴇ́ʀᴇ́: ${result.code}*`);
              console.log(`*⏰ ᴇxᴘɪʀᴇ ᴅᴀɴs: ${Math.floor(result.expiresIn / 1000 / 60)} ᴍɪɴᴜᴛᴇs*\n`);

              console.log('*📋 ɪɴsᴛʀᴜᴄᴛɪᴏɴs:*');
              console.log('*ɪ- ᴏᴜᴠʀᴇᴢ ᴡʜᴀᴛsᴀᴘᴘ sᴜʀ ᴠᴏᴛʀᴇ ᴛᴇ́ʟᴇ́ᴘʜᴏɴᴇ*');
              console.log('*ɪɪ- ᴀʟʟᴇᴢ ᴅᴀɴs ᴘᴀʀᴀᴍᴇ̀ᴛʀᴇs → ᴀᴘᴘᴀʀᴇɪʟs ʟɪᴇ́s*');
              console.log('*ɪɪɪ- ᴀᴘᴘᴜʏᴇᴢ sᴜʀ ʟɪᴇʀ ᴜɴ ᴀᴘᴘᴀʀᴇɪʟ*');
              console.log('*ɪᴠ- sᴇ́ʟᴇᴄᴛɪᴏɴɴᴇᴢ "ʟɪᴇʀ ᴀᴠᴇᴄ ᴜɴ ɴᴜᴍᴇ́ʀᴏ ᴅᴇ ᴛᴇ́ʟᴇ́ᴘʜᴏɴᴇ*');
              console.log(`*ᴠ- ᴇɴᴛʀᴇᴢ ʟᴇ ᴄᴏᴅᴇ: ${result.code}*\n`);

              console.log('*👀 sᴜʀᴠᴇɪʟʟᴀɴᴄᴇ ᴅᴜ sᴛᴀᴛᴜᴛ...*\n');
              
              let attempts = 0;
              const maxAttempts = 60;
              
              const statusInterval = setInterval(() => {
                attempts++;
                const status = getSessionStatus(customNumber);
                
                console.log(`[${attempts}/${maxAttempts}] sᴛᴀᴛᴜs: ${status.status} | ʀᴇᴄᴏɴɴᴇᴄᴛ: ${status.reconnectAttempts}`);
                
                if (status.status === 'ᴄᴏɴɴᴇᴄᴛᴇᴅ') {
                  console.log('\n*🎉 sᴜᴄᴄᴇ̀s! ʙᴏᴛ ᴄᴏɴɴᴇᴄᴛᴇ́!*');
                  clearInterval(statusInterval);
                  
                  setTimeout(async () => {
                    await cleanupSession(customNumber);
                    console.log('*🧹 sᴇssɪᴏɴ ɴᴇᴛᴛᴏʏᴇ́ᴇ*');
                    process.exit(0);
                  }, 5000);
                  
                } else if (attempts >= maxAttempts) {
                  console.log('\n*⏰ ᴛɪᴍᴇᴏᴜᴛ ᴀᴛᴛᴇɪɴᴛ*');
                  clearInterval(statusInterval);
                  
                  setTimeout(async () => {
                    await cleanupSession(customNumber);
                    console.log('*🧹 sᴇssɪᴏɴ ɴᴇᴛᴛᴏʏᴇ́ᴇ*');
                    process.exit(1);
                  }, 1000);
                }
              }, 5000);
            }
          } else {
            console.error('*❌ ᴇʀʀᴇᴜʀ:*', result.message);
            process.exit(1);
          }

        } catch (error) {
          console.error('*❌ ᴇʀʀᴇᴜʀ ʟᴏʀs ᴅᴜ ᴛᴇsᴛ:*', error.message);
          process.exit(1);
        }
      }
      
      testWithCustomNumber();
    } else {
      console.error('*❌ ɴᴜᴍᴇ́ʀᴏ ɪɴᴠᴀʟɪᴅᴇ. ᴜᴛɪʟɪsᴇᴢ ᴜɴ ɴᴜᴍᴇ́ʀᴏ ᴀᴠᴇᴄ ᴀᴜ ᴍᴏɪɴs 10 ᴄʜɪғғʀᴇs.*');
      console.log('*ᴜsᴀɢᴇ: ɴᴏᴅᴇ ᴛᴇsᴛ-ᴘᴇʀsɪsᴛᴇɴᴛ-ᴘᴀɪʀɪɴɢ.ᴊs [ɴᴜᴍᴇ́ʀᴏ]*');
      console.log('ᴇxᴇᴍᴘʟᴇ: ɴᴏᴅᴇ ᴛᴇsᴛ-ᴘᴇʀsɪsᴛᴇɴᴛ-ᴘᴀɪʀɪɴɢ.ᴊs 529711221986');
      process.exit(1);
    }
  } else {
    console.log('*ℹ️ ᴀᴜᴄᴜɴ ɴᴜᴍᴇ́ʀᴏ ғᴏᴜʀɴɪ, ᴜᴛɪʟɪsᴀᴛɪᴏɴ ᴅᴜ ɴᴜᴍᴇ́ʀᴏ ᴘᴀʀ ᴅᴇ́ғᴀᴜᴛ*');
    console.log('*ᴜsᴀɢᴇ: ɴᴏᴅᴇ ᴛᴇsᴛ-ᴘᴇʀsɪsᴛᴇɴᴛ-ᴘᴀɪʀɪɴɢ.ᴊs [ɴᴜᴍᴇ́ʀᴏ]*');
    console.log('ᴇxᴇᴍᴘʟᴇ: ɴᴏᴅᴇ ᴛᴇsᴛ-ᴘᴇʀsɪsᴛᴇɴᴛ-ᴘᴀɪʀɪɴɢ.ᴊs 529711221986*\n');
    testPersistentPairing();
  }
}

module.exports = { testPersistentPairing };