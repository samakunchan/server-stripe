require('dotenv').config();
const express = require('express');
const Stripe = require('stripe');
const cors = require('cors');

const app = express();
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

app.use(cors({ origin: '*' }));
app.use(express.json());

/**
 * Method GET
 * @example
 * Réponse : 'Le serveur est actif'
 */
app.get('/', async (req, res) => {
  res.json({message : 'Le serveur perso stripe est actif'});
});

/**
 * Method GET /products
 * @example
 * [
 *     {
 *         "id": "prod_xxxxx",
 *         "name": "name",
 *         "description": "description",
 *         "priceId": "price_xxxxx",
 *         "price": 49,
 *         "currency": "eur"
 *     }
 * ]
 */
app.get('/products', async (req, res) => {
  try {
    const products = await stripe.products.list();
    const prices = await stripe.prices.list();

    // Associer les prix aux produits
    const productsWithPrices = products.data.map(product => {
      const price = prices.data.find(p => p.product === product.id);
      return {
        id: product.id,
        name: product.name,
        description: product.description,
        priceId: price ? price.id : null,
        price: price ? (price.unit_amount / 100) : null,
        currency: price ? price.currency : null,
      };
    });

    res.json(productsWithPrices);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Method GET
 * @example
 * Réponse : 'Le serveur est actif'
 */
app.get('/subscriptions', async (req, res) => {
  try {
    const subscriptions = await stripe.subscriptions.list({
      status: 'active',
      limit: 10
    });
    subscriptions.data.forEach(sub => {
      console.log(`ID: ${sub.id}, Customer: ${sub.customer}, Status: ${sub.status}`);
    });
    res.json({subscriptions: subscriptions.data});
  } catch (e) {
    res.status(400).json({message: 'Impossible de lister les abonnements.', error: e});
  }
});

app.post('/create-payment-intent', async (req, res) => {
  const { amount, currency } = req.body;

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount,
      currency: currency,
      payment_method_types: ["card"],
    });

    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Method POST /create-subscription
 * @example
 * Input
 * {
 *   "priceId": "price_xxxxxx",
 *   "email": "email@test.com",
 *   "trialDays": 14 (optionel)
 * }
 *
 * @example 200
 * Output
 * {
 *     "subscriptionId": "sub_xxxx",
 *     "clientSecret": null,
 *     "trial_end": 99999999
 * }
 * @example 400
 * Output
 * {
 *     "error": "L'utilisateur a déjà un abonnement actif ou en période d'essai."
 * }
 */
app.post('/create-subscription', async (req, res) => {
  try {
    const { priceId, email, trialDays } = req.body;

    if (!priceId || !email) {
      return res.status(400).json({ error: "priceId et email sont requis" });
    }

    // Vérifier si le client existe déjà
    const customers = await stripe.customers.list({ email });
    let customer = customers.data.length > 0 ? customers.data[0] : null;

    if (!customer) {
      customer = await stripe.customers.create({ email: email });
    }

    // Vérifier si l'utilisateur a déjà un abonnement actif ou en période d'essai
    const subscriptions = await stripe.subscriptions.list({
      customer: customer.id,
      status: 'all', // On récupère tous les abonnements
      limit: 10
    });

    const hasActiveOrTrialingSubscription = subscriptions.data.some(sub =>
      ['active', 'trialing'].includes(sub.status)
    );

    if (hasActiveOrTrialingSubscription) {
      return res.status(400).json({ error: "L'utilisateur a déjà un abonnement actif ou en période d'essai." });
    }

    // Créer l'abonnement avec une période d'essai (si définie)
    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: priceId }],
      trial_period_days: trialDays || 0,
      payment_behavior: 'default_incomplete',
      expand: ['latest_invoice.payment_intent'],
    });

    res.json({
      subscriptionId: subscription.id,
      clientSecret: subscription.latest_invoice?.payment_intent?.client_secret || null,
      trial_end: subscription.trial_end || null,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Method POST /cancel-subscription
 *
 * @example Pour annuler l'abonnement à date
 * Input
 * {
 *   "email": "samakunchan@gmail.com",
 * }
 * ou
 *
 * @example Pour annuler l'abonnement immédiatement
 * Input
 * {
 *   "email": "samakunchan@gmail.com",
 *   "cancelImmediately": true
 * }
 *
 * @example 200
 * Output
 * {
 *     "message": "L'abonnement sera annulé à la fin de la période.",
 *     "subscriptionId": "sub_xxxx",
 *     "status": "xxxxx" (trailing, active, ect...)
 * }
 * @example 200
 * Output
 * {
 *     "message": "L'abonnement a été annulé immédiatement.",
 *     "subscriptionId": "sub_xxxx",
 *     "status": "canceled"
 * }
 * @example 404
 * Output
 * {
 *     "error": "Aucun abonnement actif ou en essai trouvé."
 * }
 */
app.post('/cancel-subscription', async (req, res) => {
  try {
    const { email, cancelImmediately } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email requis" });
    }

    // Récupérer le client Stripe
    const customers = await stripe.customers.list({ email });

    if (customers.data.length === 0) {
      return res.status(404).json({ error: "Utilisateur non trouvé" });
    }
    const customer = customers.data[0];

    // Récupérer l'abonnement actif ou en période d'essai
    const subscriptions = await stripe.subscriptions.list({
      customer: customer.id,
      status: 'all',
      limit: 10
    });

    const activeSubscription = subscriptions.data.find(sub =>
      ['active', 'trialing'].includes(sub.status)
    );

    if (!activeSubscription) {
      return res.status(404).json({ error: "Aucun abonnement actif ou en essai trouvé." });
    }

    let canceledSubscription;

    if (cancelImmediately) {
      // 🚨 Annulation immédiate (supprime aussi la période d’essai)
      canceledSubscription = await stripe.subscriptions.cancel(activeSubscription.id);
    } else {
      // ⏳ Annulation à la fin de la période (l'utilisateur garde son abonnement jusqu'à la fin)
      canceledSubscription = await stripe.subscriptions.update(activeSubscription.id, {
        cancel_at_period_end: true
      });
    }

    res.json({
      message: cancelImmediately
        ? "L'abonnement a été annulé immédiatement."
        : "L'abonnement sera annulé à la fin de la période.",
      subscriptionId: canceledSubscription.id,
      status: canceledSubscription.status
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Method POST /restore-subscription
 *
 * @example Pour annuler l'abonnement à date
 * Input
 * {
 *   "email": "samakunchan@gmail.com",
 * }
 *
 * @example 200
 * Output
 * {
 *     "message": "L'abonnement a été restauré avec succès.",
 *     "subscriptionId": "sub_xxxx",
 *     "status": "trailing"
 * }
 * @example 400
 * Output
 * {
 *     "error": "Aucun abonnement à restaurer."
 * }
 * @example 404
 * Output
 * {
 *     "error": "Aucun abonnement annulé à restaurer. Créez un nouvel abonnement."
 * }
 */
app.post('/restore-subscription', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email requis" });
    }

    // Récupérer le client Stripe
    const customers = await stripe.customers.list({ email });
    if (customers.data.length === 0) {
      return res.status(404).json({ error: "Utilisateur non trouvé" });
    }
    const customer = customers.data[0];

    // Récupérer les abonnements du client
    const subscriptions = await stripe.subscriptions.list({
      customer: customer.id,
      status: 'all',
      limit: 10
    });

    // Vérifier s'il y a un abonnement annulé mais encore actif (en période d'essai ou actif)
    const pendingCancellation = subscriptions.data.find(sub =>
      sub.cancel_at_period_end && ['active', 'trialing'].includes(sub.status)
    );

    if (pendingCancellation) {
      // ✅ Restaurer en supprimant `cancel_at_period_end`
      const restoredSubscription = await stripe.subscriptions.update(pendingCancellation.id, {
        cancel_at_period_end: false
      });

      return res.json({
        message: "L'abonnement a été restauré avec succès.",
        subscriptionId: restoredSubscription.id,
        status: restoredSubscription.status
      });
    }

    res.status(400).json({ error: "Aucun abonnement à restaurer." });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// Lancer le serveur
const PORT = process.env.PORT || 5001;
app.listen(PORT, '0.0.0.0',() => {
  console.log(`Serveur démarré sur http://localhost:${PORT}`);
});
