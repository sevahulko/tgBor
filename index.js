const TelegramBot = require('node-telegram-bot-api');
const mongoose = require('mongoose');
const FuzzySet = require('fuzzyset');

const token = '6728558992:AAEXvqpn33bFslKPGMet2A0vm6RxGv7UfeA';
const bot = new TelegramBot(token, { polling: true });

const mongoDBUri = 'mongodb+srv://sevagulko747:5Ronaldinho@cluster0.rgdkql5.mongodb.net/store?retryWrites=true&w=majority';

bot.setMyCommands([
  {command:'/start',description: 'начало работа'},
  {command:'/info',description: 'Все команды для бота'}
  
])
mongoose
  .connect(mongoDBUri)
  .then(() => console.log('Подключено к MongoDB'))
  .catch((error) => console.error('Ошибка подключения к MongoDB:', error));


//коллекции
const storeCheck = mongoose.model('storeCheck', { Name: String });
const Store = mongoose.model('Store', { Name: String, value: Boolean });

const fuzzyStores = FuzzySet();


//функция в помощи в поиске магазина
const fillFuzzyStores = async () => {
  try {
    const stores = await Store.find({});
    stores.forEach((store) => {
      fuzzyStores.add(store.Name);
    });
  } catch (error) {
    console.error('Ошибка при получении списка магазинов:', error);
  }
};


//функция в помощи в поиске магазина
const HelpFindStore = async (Name) => {
  const matches = fuzzyStores.get(Name, null, 0.5);
  if (matches && matches.length > 0) {
    const bestMatchName = matches[0][1];
    return bestMatchName ? await Store.findOne({ Name: bestMatchName }) : null;
  }
  return null;
};



//Начало
mongoose.connection.once('open', async () => {
  await fillFuzzyStores();

  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text.toLowerCase();

    const userMessage = text.replace('/check', '').trim();
    const store = await Store.findOne({ Name: userMessage });
    const existingCheck = await storeCheck.findOne({ Name: userMessage });


    //оброботка команд бота
    if(text == '/start'){
      bot.sendMessage(chatId,'Для проверки введите имя магазина')
      return
    }

    if(text == '/info'){
      bot.sendMessage(chatId,'Часть информации взята из legit_community, если магазина который вы хотите проверить нет в боте, напишите команду "/check имя магазина"')
      return
    }
    //обработка чек
    try {
      if (text.startsWith('/check')) {
        if (existingCheck) {
          bot.sendMessage(chatId, `Магазин "${userMessage}" уже находится на проверке.`);
        } else if (store) {
          bot.sendMessage(chatId, `Этот магазин уже проверен.`);
        } else {
          const newCheckStore = new storeCheck({ Name: userMessage });
          await newCheckStore.save();
          bot.sendMessage(chatId, `Мы проверим этот магазин в ближайшее время.`);
        }
      } else {
        //проверка магазина
        if (store) {                      
          console.log('Магазин найден:', store);
          const message = store.value
            ? `✅ Магазин "${store.Name}" безопасен для покупок.`
            : `⚠️ Внимание! В магазине "${store.Name}" могут продаваться поддельные товары. Не рекомендуем здесь покупать.`;
          bot.sendMessage(chatId, message);
        } 
        //если не найден магазин
        else {                          
          console.log('Магазин не найден.');
          const bestMatchStore = await HelpFindStore(userMessage);
          if (bestMatchStore && bestMatchStore.Name) {
            const message = bestMatchStore.value
              ? `✅ Магазин "${bestMatchStore.Name}" безопасен для покупок.`
              : `⚠️ Внимание! В магазине "${bestMatchStore.Name}" могут продаваться поддельные товары. Не рекомендуем здесь покупать.`;
            bot.sendMessage(chatId, message);
          } else {
            bot.sendMessage(chatId, 'Магазин не найден.');
          }
        }
      }
    } catch (error) {
      console.error('Ошибка при обработке сообщения:', error);
    }
  });
});



