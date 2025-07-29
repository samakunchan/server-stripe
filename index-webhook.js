// Pour éviter de polluer, j'ai mis le webhook dans :
// - son propre fichier
// - son propre port pour son propre serveur
// Le cors n'a pas l'air d'être obligatoire (à voir)
// Surtout pas de :"app.use(express.json());" qui apparement n'est pas recommandé.
require('dotenv').config();
const express = require('express');
const Stripe = require('stripe');

const app = express();
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

/**
 * Pour tester en local, il faudrait le Stripe CLI. Sinon à vous de vous démerder.
 * @example
 * ```shell
 * stripe login
 * ```
 * ```shell
 * stripe listen --api-key=[STRIPE_SECRET_KEY] --forward-to localhost:5002/webhook
 * # Récuperer le résultat qui donnera une clé : "whsec_2c...."
 * # A mettre pour [STRIPE_WEBHOOK_SECRET_KEY]
 * ```
 * Pour tester en ligne, il faut configurer le compte Stripe. En bas de page à gauche, il y a un bouton "Développeur" qui mène aux webhook.
 * Puis à voir pour le reste j'ai pas encore tester.
 */
app.post('/webhook', express.raw({type: 'application/json'}), async (req, res) => {
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET_KEY;

  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.log(`Erreur de signature: ${err.message}`);
    return res.status(400).send(`Erreur de webhook: ${err.message}`);
  }

  // Gestion des événements d'abonnement
  switch (event.type) {
    // Création d'un abonnement
    case 'customer.subscription.created':
      const subscriptionCreated = event.data.object;
      console.log('Nouvel abonnement créé:', subscriptionCreated.id);

      break;

    // Mise à jour d'un abonnement (changement de plan, etc.)
    case 'customer.subscription.updated':
      const option = {
        hour: '2-digit',
        minute:'2-digit',
        second:'2-digit',
      };
      const subscriptionUpdated = event.data.object;
      console.log('Abonnement mis à jour:', subscriptionUpdated.id);
      console.log({
        customer: subscriptionUpdated.customer,
        reason: subscriptionUpdated.cancellation_details.reason,
        cancel_at_period_end: subscriptionUpdated.cancel_at_period_end, // booléens => Annulation en cours ou pas
        canceled_at: subscriptionUpdated.canceled_at,
        cancel_at: subscriptionUpdated.cancel_at,
        dateFormatted : {
          created: new Date(subscriptionUpdated.created * 1000).toLocaleDateString('fr-FR', option),
          canceled_at: new Date(subscriptionUpdated.canceled_at * 1000).toLocaleDateString('fr-FR', option),
          cancel_at: new Date(subscriptionUpdated.cancel_at * 1000).toLocaleDateString('fr-FR', option),
        },
        created: subscriptionUpdated.created,
        latest_invoice: subscriptionUpdated.latest_invoice,
        plan: subscriptionUpdated.plan,
        status: subscriptionUpdated.status,
        previous_attributes: event.data.previous_attributes,
      });

      // Vérifiez si c'est une annulation programmée
      if (subscriptionUpdated.cancel_at_period_end) {
        console.log(`L'abonnement ${subscriptionUpdated.id} sera annulé à la fin de la période`);
        // Informez le client ou préparez la désactivation
      }
      break;

    // Suppression d'un abonnement (fin immédiate)
    case 'customer.subscription.deleted':
      const subscriptionDeleted = event.data.object;
      console.log('Abonnement terminé:', subscriptionDeleted.id);
      break;

    // Notification avant la fin d'un essai gratuit
    case 'customer.subscription.trial_will_end':
      const subscriptionTrial = event.data.object;
      console.log(`L'essai gratuit pour ${subscriptionTrial.id} se termine bientôt`);
      break;

    // Facture créée pour un abonnement
    case 'invoice.created':
      const invoiceCreated = event.data.object;
      if (invoiceCreated.subscription) {
        console.log(`Facture ${invoiceCreated.id} créée pour l'abonnement ${invoiceCreated.subscription}`);
      }
      break;

    // Paiement de facture réussi
    case 'invoice.paid':
      const invoicePaid = event.data.object;
      if (invoicePaid.subscription) {
        console.log(`Paiement réussi pour la facture ${invoicePaid.id} de l'abonnement ${invoicePaid.subscription}`);
        // Prolongez l'accès au service
      }
      break;

    // Échec de paiement de facture
    case 'invoice.payment_failed':
      const invoiceFailed = event.data.object;
      if (invoiceFailed.subscription) {
        console.log(`Échec de paiement pour la facture ${invoiceFailed.id} de l'abonnement ${invoiceFailed.subscription}`);
      }
      break;

    default:
  }

  // Confirmation de réception
  res.status(200).send();
});

// Lancer le serveur
const PORT = process.env.PORT_WEBHOOK || 5002;
app.listen(PORT, '0.0.0.0',() => {
  console.log(`Serveur Web hook démarré sur http://localhost:${PORT}`);
});
