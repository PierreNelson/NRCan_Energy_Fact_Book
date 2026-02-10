import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
const BREADCRUMBS = [
    {
        title: { en: 'Canada.ca', fr: 'Canada.ca' },
        link: { en: 'https://www.canada.ca/en.html', fr: 'https://www.canada.ca/fr.html' }
    },
    {
        title: { en: 'Environment and natural resources', fr: 'Environnement et ressources naturelles' },
        link: { en: 'https://www.canada.ca/en/services/environment.html', fr: 'https://www.canada.ca/fr/services/environnement.html' }
    },
    {
        title: { en: 'Energy', fr: 'Énergie' },
        link: { en: 'https://www.canada.ca/en/services/environment/energy.html', fr: 'https://www.canada.ca/fr/services/environnement/energie.html' }
    },
    {
        title: { en: 'Canadian Centre for Energy Information', fr: "Centre canadien d'information sur l'énergie" },
        link: { en: 'https://energy-information.canada.ca/en', fr: 'https://information-energie.canada.ca/fr' }
    },
    {
        title: { en: 'Energy Fact Book', fr: "Cahier d'information sur l'énergie" },
        link: { en: '/section-1#energy-overview', fr: '/section-1#energy-overview' },
        isInternal: true
    }
];
// Full MENU_DATA restored from your uploaded file
const MENU_DATA = [
    {
        id: 'jobs',
        label: { en: 'Jobs and the workplace', fr: 'Emplois et milieu de travail' },
        title: { en: 'Jobs', fr: 'Emplois' },
        homeLink: { en: 'https://www.canada.ca/en/services/jobs.html', fr: 'https://www.canada.ca/fr/services/emplois.html' },
        items: [
            { en: 'Job Bank', fr: 'Guichet-Emplois', urlEn: 'https://www.jobbank.gc.ca/findajob', urlFr: 'https://www.guichetemplois.gc.ca/trouverunemploi' },
            { en: 'Government of Canada jobs', fr: 'Emplois au gouvernement du Canada', urlEn: 'https://www.canada.ca/en/services/jobs/opportunities/government.html', urlFr: 'https://www.canada.ca/fr/services/emplois/opportunites/gouvernement.html' },
            { en: 'Student employment', fr: 'Emplois pour étudiants', urlEn: 'https://www.canada.ca/en/services/jobs/opportunities/student.html', urlFr: 'https://www.canada.ca/fr/services/emplois/opportunites/etudiants.html' },
            { en: 'Jobs in national security and defence', fr: 'Emplois en sécurité nationale et défense', urlEn: 'https://www.canada.ca/en/services/defence/jobs.html', urlFr: 'https://www.canada.ca/fr/services/defense/emplois.html' },
            { en: 'Moving within Canada to work', fr: 'Déménager ailleurs au Canada pour travailler', urlEn: 'https://www.canada.ca/en/employment-social-development/programs/labour-mobility.html', urlFr: 'https://www.canada.ca/fr/emploi-developpement-social/programmes/mobilite-main-doeuvre.html' },
            { en: 'Funding for jobs and training', fr: 'Financement pour les emplois et formations', urlEn: 'https://www.canada.ca/en/employment-social-development/services/funding/programs.html', urlFr: 'https://www.canada.ca/fr/emploi-developpement-social/services/financement/programmes.html' },
            { en: 'Training', fr: 'Formation', urlEn: 'https://www.canada.ca/en/services/jobs/training.html', urlFr: 'https://www.canada.ca/fr/services/emplois/formation.html' },
            { en: 'Hiring and managing employees', fr: 'Embauche et gestion de personnel', urlEn: 'https://www.canada.ca/en/services/business/hire.html', urlFr: 'https://www.canada.ca/fr/services/entreprises/engager.html' },
            { en: 'Starting a business', fr: 'Démarrage d\'entreprise', urlEn: 'https://www.canada.ca/en/services/business/start.html', urlFr: 'https://www.canada.ca/fr/services/entreprises/lancer.html' },
            { en: 'Employment Insurance benefits and leave', fr: 'Prestations d\'assurance-emploi et congés', urlEn: 'https://www.canada.ca/en/services/benefits/ei.html', urlFr: 'https://www.canada.ca/fr/services/prestations/ae.html' },
            { en: 'Workplace standards', fr: 'Normes en milieu de travail', urlEn: 'https://www.canada.ca/en/services/jobs/workplace.html', urlFr: 'https://www.canada.ca/fr/services/emplois/milieu-travail.html' },
            { en: 'Pensions and retirement', fr: 'Pensions et retraite', urlEn: 'https://www.canada.ca/en/services/finance/pensions.html', urlFr: 'https://www.canada.ca/fr/services/finance/pensions.html' },
        ],
        mostRequested: [
            { en: 'Work in Canada - work permits', fr: 'Travailler au Canada - permis de travail', urlEn: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/work-canada.html', urlFr: 'https://www.canada.ca/fr/immigration-refugies-citoyennete/services/travailler-canada.html' },
            { en: 'Immigrate as a skilled worker', fr: 'Immigrer en tant que travailleur qualifié', urlEn: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry.html', urlFr: 'https://www.canada.ca/fr/immigration-refugies-citoyennete/services/immigrer-canada/entree-express.html' },
            { en: 'Hire a temporary foreign worker', fr: 'Embaucher un travailleur étranger temporaire', urlEn: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/work-canada/hire-temporary-foreign.html', urlFr: 'https://www.canada.ca/fr/immigration-refugies-citoyennete/services/travailler-canada/embaucher-etranger-temporaires.html' },
            { en: 'Federal Skilled Worker Program', fr: 'Programme des travailleurs qualifiés - fédéral', urlEn: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/who-can-apply/federal-skilled-workers.html', urlFr: 'https://www.canada.ca/fr/immigration-refugies-citoyennete/services/immigrer-canada/entree-express/qui-presenter-demande/travailleurs-qualifies-federal.html' },
            { en: 'View your records of employment', fr: 'Voir vos relevés d\'emploi', urlEn: 'https://www.canada.ca/en/employment-social-development/services/my-account.html', urlFr: 'https://www.canada.ca/fr/emploi-developpement-social/services/mon-dossier.html' },
            { en: 'Submit a record of employment - employers', fr: 'Soumettre des relevés d\'emploi en ligne - employeurs', urlEn: 'https://www.canada.ca/en/employment-social-development/programs/ei/ei-list/ei-roe/access-roe.html', urlFr: 'https://www.canada.ca/fr/emploi-developpement-social/programmes/assurance-emploi/ae-liste/assurance-emploi-re/acceder-re.html' },
            { en: 'Federal Student Work Experience Program (FSWEP)', fr: 'Programme fédéral d\'expérience de travail étudiant (PFETE)', urlEn: 'https://www.canada.ca/en/public-service-commission/jobs/services/recruitment/students/federal-student-work-program.html', urlFr: 'https://www.canada.ca/fr/commission-fonction-publique/emplois/services/recrutement/etudiants/programme-federal-experience-travail-etudiant.html' },
            { en: 'Apply for a Social Insurance Number (SIN)', fr: 'Demander un numéro d\'assurance-sociale', urlEn: 'https://www.canada.ca/en/employment-social-development/services/sin.html', urlFr: 'https://www.canada.ca/fr/emploi-developpement-social/services/numero-assurance-sociale.html' },
        ]
    },
    {
        id: 'immigration',
        label: { en: 'Immigration and citizenship', fr: 'Immigration et citoyenneté' },
        title: { en: 'Immigration and citizenship', fr: 'Immigration' },
        homeLink: { en: 'https://www.canada.ca/en/services/immigration-citizenship.html', fr: 'https://www.canada.ca/fr/services/immigration-citoyennete.html' },
        items: [
            { en: 'IRCC applications', fr: 'Demandes à IRCC', urlEn: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/application.html', urlFr: 'https://www.canada.ca/fr/immigration-refugies-citoyennete/services/demande.html' },
            { en: 'Visit Canada', fr: 'Visiter le Canada', urlEn: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/visit-canada.html', urlFr: 'https://www.canada.ca/fr/immigration-refugies-citoyennete/services/visiter-canada.html' },
            { en: 'Live in Canada permanently', fr: 'Vivre au Canada de façon permanente', urlEn: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada.html', urlFr: 'https://www.canada.ca/fr/immigration-refugies-citoyennete/services/immigrer-canada.html' },
            { en: 'Work in Canada temporarily', fr: 'Travailler au Canada de façon temporaire', urlEn: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/work-canada.html', urlFr: 'https://www.canada.ca/fr/immigration-refugies-citoyennete/services/travailler-canada.html' },
            { en: 'Study in Canada', fr: 'Étudier au Canada', urlEn: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/study-canada.html', urlFr: 'https://www.canada.ca/fr/immigration-refugies-citoyennete/services/etudier-canada.html' },
            { en: 'Refugees and asylum', fr: 'Réfugiés et demandes d\'asile', urlEn: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/refugees.html', urlFr: 'https://www.canada.ca/fr/immigration-refugies-citoyennete/services/refugies.html' },
            { en: 'International Experience Canada (IEC)', fr: 'Expérience internationale Canada (EIC)', urlEn: 'https://ircc.canada.ca/iec/index.asp', urlFr: 'https://ircc.canada.ca/eic/index.asp' },
            { en: 'Passports and other travel documents', fr: 'Passeports et autres documents de voyage', urlEn: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/canadian-passports.html', urlFr: 'https://www.canada.ca/fr/immigration-refugies-citoyennete/services/passeports-canadiens.html' },
            { en: 'Citizenship', fr: 'Citoyenneté', urlEn: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/canadian-citizenship.html', urlFr: 'https://www.canada.ca/fr/immigration-refugies-citoyennete/services/citoyennete-canadienne.html' },
            { en: 'Permanent resident (PR) cards and status', fr: 'Carte et statut de résident permanent (RP)', urlEn: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/permanent-residents.html', urlFr: 'https://www.canada.ca/fr/immigration-refugies-citoyennete/services/residents-permanents.html' },
            { en: 'Settling in Canada as a newcomer', fr: 'S\'établir au Canada à titre de nouvel arrivant', urlEn: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/settle-canada.html', urlFr: 'https://www.canada.ca/fr/immigration-refugies-citoyennete/services/setablir-canada.html' },
            { en: 'International adoption', fr: 'Adoption internationale', urlEn: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/canadians/adopt-child-abroad.html', urlFr: 'https://www.canada.ca/fr/immigration-refugies-citoyennete/services/canadiens/adopter-enfant-autre-pays.html' },
            { en: 'Explore immigration programs', fr: 'Explorer les programmes d\'immigration', urlEn: 'https://ircc.canada.ca/explore-programs/index.asp', urlFr: 'https://ircc.canada.ca/explorer-programmes/index.asp' },
            { en: 'Immigration fraud and scams', fr: 'Fraudes et arnaques en matière d\'immigration', urlEn: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/protect-fraud.html', urlFr: 'https://www.canada.ca/fr/immigration-refugies-citoyennete/services/proteger-fraude.html' },
            { en: 'Inadmissibility, enforcement and appeals', fr: 'Interdiction de territoire, application de la loi et appels', urlEn: 'https://www.canada.ca/en/services/immigration-citizenship/enforcement-violations.html', urlFr: 'https://www.canada.ca/fr/services/immigration-citoyennete/application-loi-infractions.html' },
        ],
        mostRequested: [
            { en: 'Sign in to your IRCC account', fr: 'Connectez-vous à votre compte d\'IRCC', urlEn: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/application/ircc-accounts.html', urlFr: 'https://www.canada.ca/fr/immigration-refugies-citoyennete/services/demande/comptes-ircc.html' },
            { en: 'Check your application status', fr: 'Vérifiez l\'état de votre demande', urlEn: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/application/check-status.html', urlFr: 'https://www.canada.ca/fr/immigration-refugies-citoyennete/services/demande/verifier-etat.html' },
            { en: 'Current processing times', fr: 'Délais de traitement actuels', urlEn: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/application/check-processing-times.html', urlFr: 'https://www.canada.ca/fr/immigration-refugies-citoyennete/services/demande/verifier-delais-traitement.html' },
            { en: 'Find an application form', fr: 'Trouvez un formulaire de demande', urlEn: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/application/application-forms-guides.html', urlFr: 'https://www.canada.ca/fr/immigration-refugies-citoyennete/services/demande/formulaires-demande-guides.html' },
            { en: 'Portals for representatives and partners', fr: 'Portails pour les représentants et les partenaires', urlEn: 'https://www.canada.ca/en/immigration-refugees-citizenship/corporate/partners-service-providers.html', urlFr: 'https://www.canada.ca/fr/immigration-refugies-citoyennete/organisation/partenaires-fournisseurs-services.html' },
        ]
    },
    {
        id: 'travel',
        label: { en: 'Travel and tourism', fr: 'Voyage et tourisme' },
        title: { en: 'Travel and tourism', fr: 'Voyage' },
        homeLink: { en: 'https://travel.gc.ca/', fr: 'https://voyage.gc.ca/' },
        items: [
            { en: 'Travel advice and advisories', fr: 'Conseils aux voyageurs et avertissements', urlEn: 'https://travel.gc.ca/travelling/advisories', urlFr: 'https://voyage.gc.ca/voyager/avertissements' },
            { en: 'Travel outside Canada', fr: 'Voyager à l\'étranger', urlEn: 'https://travel.gc.ca/travelling', urlFr: 'https://voyage.gc.ca/voyager' },
            { en: 'Air travel', fr: 'Voyager en avion', urlEn: 'https://travel.gc.ca/air', urlFr: 'https://voyage.gc.ca/avion' },
            { en: 'Canadian passports and travel documents', fr: 'Passeports et documents de voyage canadiens', urlEn: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/canadian-passports.html', urlFr: 'https://www.canada.ca/fr/immigration-refugies-citoyennete/services/passeports-canadiens.html' },
            { en: 'Stay connected', fr: 'Restez branchés', urlEn: 'https://travel.gc.ca/stay-connected', urlFr: 'https://voyage.gc.ca/restez-branches' },
            { en: 'Assistance outside Canada', fr: 'Assistance à l\'étranger', urlEn: 'https://travel.gc.ca/assistance', urlFr: 'https://voyage.gc.ca/assistance' },
            { en: 'Visit Canada', fr: 'Visiter le Canada', urlEn: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/visit-canada.html?outside', urlFr: 'https://www.canada.ca/fr/immigration-refugies-citoyennete/services/visiter-canada.html?outside' },
            { en: 'Return or travel to Canada', fr: 'Retour ou voyage au Canada', urlEn: 'https://travel.gc.ca/returning', urlFr: 'https://voyage.gc.ca/retour' },
            { en: 'Canadian attractions, events and experiences', fr: 'Attraits touristiques, événements et expériences au Canada', urlEn: 'https://travel.gc.ca/canadian-tourism', urlFr: 'https://voyage.gc.ca/tourisme-canadien' },
        ],
        mostRequested: [
            { en: 'Emergency assistance abroad', fr: 'Assistance d\'urgence à l\'étranger', urlEn: 'https://travel.gc.ca/assistance/emergency-assistance', urlFr: 'https://voyage.gc.ca/assistance/assistance-d-urgence' },
            { en: 'Find out if you need a visa to travel to Canada', fr: 'Vérifiez si vous avez besoin d\'un visa pour voyager au Canada', urlEn: 'https://www.ircc.canada.ca/english/visit/visas.asp', urlFr: 'https://ircc.canada.ca/francais/visiter/visas.asp' },
            { en: 'Apply for an eTA', fr: 'Présentez une demande d\'Autorisation de voyage électronique (AVE)', urlEn: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/visit-canada/eta.html', urlFr: 'https://www.canada.ca/fr/immigration-refugies-citoyennete/services/visiter-canada/ave.html' },
            { en: 'Apply for NEXUS', fr: 'Adhérez à NEXUS', urlEn: 'https://www.cbsa-asfc.gc.ca/services/travel-voyage/prog/nexus/menu-eng.html', urlFr: 'https://www.cbsa-asfc.gc.ca/services/travel-voyage/prog/nexus/menu-fra.html' },
            { en: 'Register as a Canadian abroad', fr: 'Inscrivez-vous comme Canadien à l\'étranger', urlEn: 'https://travel.gc.ca/travelling/registration', urlFr: 'https://voyage.gc.ca/voyager/inscription' },
            { en: 'Travel insurance', fr: 'Assurance voyage', urlEn: 'https://travel.gc.ca/travelling/documents/travel-insurance', urlFr: 'https://voyage.gc.ca/voyager/documents/assurance-voyage' },
        ]
    },
    {
        id: 'business',
        label: { en: 'Business and industry', fr: 'Entreprises et industrie' },
        title: { en: 'Business and industry', fr: 'Entreprises' },
        homeLink: { en: 'https://www.canada.ca/en/services/business.html', fr: 'https://www.canada.ca/fr/services/entreprises.html' },
        items: [
            { en: 'Starting a business', fr: 'Démarrage d\'entreprise', urlEn: 'https://www.canada.ca/en/services/business/start.html', urlFr: 'https://www.canada.ca/fr/services/entreprises/lancer.html' },
            { en: 'Business taxes', fr: 'Taxes et impôt des entreprises', urlEn: 'https://www.canada.ca/en/services/business/taxes.html', urlFr: 'https://www.canada.ca/fr/services/entreprises/impots.html' },
            { en: 'Business financing and support', fr: 'Subventions et financement pour les entreprises', urlEn: 'https://innovation.ised-isde.canada.ca/s/?language=en_CA', urlFr: 'https://innovation.ised-isde.canada.ca/innovation/s/?language=fr_CA' },
            { en: 'Federal corporations', fr: 'Sociétés de régime fédéral', urlEn: 'https://ised-isde.canada.ca/site/corporations-canada/en', urlFr: 'https://ised-isde.canada.ca/site/corporations-canada/fr' },
            { en: 'Maintaining your business', fr: 'Administration de votre entreprise', urlEn: 'https://www.canada.ca/en/services/business/maintaingrowimprovebusiness.html', urlFr: 'https://www.canada.ca/fr/services/entreprises/maintenirfairecroitreameliorerentreprise.html' },
            { en: 'Permits, licences and regulations', fr: 'Permis, licences et règlements', urlEn: 'https://www.canada.ca/en/services/business/permits.html', urlFr: 'https://www.canada.ca/fr/services/entreprises/permis.html' },
            { en: 'Hiring and managing employees', fr: 'Embauche et gestion de personnel', urlEn: 'https://www.canada.ca/en/services/business/hire.html', urlFr: 'https://www.canada.ca/fr/services/entreprises/engager.html' },
            { en: 'International trade and investment', fr: 'Commerce international et investissements', urlEn: 'https://international.canada.ca/en/services/business/trade', urlFr: 'https://international.canada.ca/fr/services/entreprises/commerce' },
            { en: 'Intellectual property and copyright', fr: 'Propriété intellectuelle et droit d\'auteur', urlEn: 'https://www.canada.ca/en/services/business/ip.html', urlFr: 'https://www.canada.ca/fr/services/entreprises/pi.html' },
            { en: 'Research and business intelligence', fr: 'Recherche et renseignements d\'affaires', urlEn: 'https://www.canada.ca/en/services/business/research.html', urlFr: 'https://www.canada.ca/fr/services/entreprises/recherche.html' },
            { en: 'Doing business with government', fr: 'Faire affaire avec le gouvernement', urlEn: 'https://www.canada.ca/en/services/business/doing-business.html', urlFr: 'https://www.canada.ca/fr/services/entreprises/faire-affaire.html' },
            { en: 'R&D and innovation', fr: 'Recherche-développement et innovation', urlEn: 'https://www.canada.ca/en/services/science/innovation.html', urlFr: 'https://www.canada.ca/fr/services/science/innovation.html' },
            { en: 'Protecting your business', fr: 'Protection de votre entreprise', urlEn: 'https://www.canada.ca/en/services/business/protecting.html', urlFr: 'https://www.canada.ca/fr/services/entreprises/proteger.html' },
            { en: 'Insolvency for business', fr: 'Insolvabilité pour les entreprises', urlEn: 'https://ised-isde.canada.ca/site/office-superintendent-bankruptcy/en/you-owe-money', urlFr: 'https://ised-isde.canada.ca/site/bureau-surintendant-faillites/fr/vous-devez-largent' },
        ],
        mostRequested: [
            { en: 'Canada\'s response to U.S. tariffs on Canadian goods', fr: 'Réponse du Canada aux droits de douane américains sur les produits canadiens', urlEn: 'https://www.canada.ca/en/department-finance/programs/international-trade-finance-policy/canadas-response-us-tariffs.html', urlFr: 'https://www.canada.ca/fr/ministere-finances/programmes/politiques-finances-echanges-internationaux/reponse-canada-droits-douane-americains.html' },
            { en: 'Find a corporation', fr: 'Trouver une société', urlEn: 'https://ised-isde.canada.ca/cc/lgcy/fdrlCrpSrch.html?locale=en_CA', urlFr: 'https://ised-isde.canada.ca/cc/lgcy/fdrlCrpSrch.html?lang=fra' },
            { en: 'File Corporations Canada annual return', fr: 'Déposez votre rapport annuel (Corporations Canada)', urlEn: 'https://ised-isde.canada.ca/site/corporations-canada/en/keep-your-corporation-good-shape/annual-return', urlFr: 'https://ised-isde.canada.ca/site/corporations-canada/fr/garder-votre-corporation-bonne-forme/rapport-annuel' },
            { en: 'My Business Account (Canada Revenue Agency)', fr: 'Mon dossier d\'entreprise (Agence du revenu du Canada)', urlEn: 'https://www.canada.ca/en/revenue-agency/services/e-services/digital-services-businesses/business-account.html', urlFr: 'https://www.canada.ca/fr/agence-revenu/services/services-electroniques/services-numeriques-entreprises/dossier-entreprise.html' },
            { en: 'Helping small businesses get loans', fr: 'Aider les petites entreprises à obtenir des prêts', urlEn: 'https://ised-isde.canada.ca/site/canada-small-business-financing-program/en', urlFr: 'https://ised-isde.canada.ca/site/programme-financement-petites-entreprises-canada/fr' },
            { en: 'Loans to improve cash flow and increase sales', fr: 'Prêts pour améliorer les encaisses et augmenter les ventes', urlEn: 'https://www.bdc.ca/en/financing/small-business-loan', urlFr: 'https://www.bdc.ca/fr/financement/pret-petites-entreprises' },
        ]
    },
    {
        id: 'benefits',
        label: { en: 'Benefits', fr: 'Prestations' },
        title: { en: 'Benefits', fr: 'Prestations' },
        homeLink: { en: 'https://www.canada.ca/en/services/benefits.html', fr: 'https://www.canada.ca/fr/services/prestations.html' },
        items: [
            { en: 'Employment Insurance benefits and leave', fr: 'Prestations d\'assurance-emploi et congés', urlEn: 'https://www.canada.ca/en/services/benefits/ei.html', urlFr: 'https://www.canada.ca/fr/services/prestations/ae.html' },
            { en: 'Canadian Dental Care Plan', fr: 'Régime canadien de soins dentaires', urlEn: 'https://www.canada.ca/en/services/benefits/dental/dental-care-plan.html', urlFr: 'https://www.canada.ca/fr/services/prestations/dentaire/regime-soins-dentaires.html' },
            { en: 'Disability benefits', fr: 'Prestations d\'invalidité', urlEn: 'https://www.canada.ca/en/services/benefits/disability.html', urlFr: 'https://www.canada.ca/fr/services/prestations/handicap.html' },
            { en: 'Family and caregiving benefits', fr: 'Prestations pour les familles et les proches aidants', urlEn: 'https://www.canada.ca/en/services/benefits/family.html', urlFr: 'https://www.canada.ca/fr/services/prestations/famille.html' },
            { en: 'Public pensions', fr: 'Pensions publiques', urlEn: 'https://www.canada.ca/en/services/benefits/publicpensions.html', urlFr: 'https://www.canada.ca/fr/services/prestations/pensionspubliques.html' },
            { en: 'Grants and funding opportunities', fr: 'Subventions et occasions de financement', urlEn: 'https://www.canada.ca/en/employment-social-development/services/funding/programs.html', urlFr: 'https://www.canada.ca/fr/emploi-developpement-social/services/financement/programmes.html' },
            { en: 'Student aid and education planning', fr: 'Aide financière aux étudiants et planification des études', urlEn: 'https://www.canada.ca/en/services/benefits/education.html', urlFr: 'https://www.canada.ca/fr/services/prestations/education.html' },
            { en: 'Housing benefits', fr: 'Prestations relatives au logement', urlEn: 'https://www.canada.ca/en/services/benefits/housing.html', urlFr: 'https://www.canada.ca/fr/services/prestations/logement.html' },
            { en: 'Benefits by audience', fr: 'Prestations par clientèle', urlEn: 'https://www.canada.ca/en/services/benefits/audience.html', urlFr: 'https://www.canada.ca/fr/services/prestations/clientele.html' },
            { en: 'Benefits payment dates', fr: 'Dates de paiement des prestations', urlEn: 'https://www.canada.ca/en/services/benefits/calendar.html', urlFr: 'https://www.canada.ca/fr/services/prestations/calendrier.html' },
            { en: 'Benefits finder', fr: 'Chercheur de prestations', urlEn: 'https://www.canada.ca/en/services/benefits/finder.html', urlFr: 'https://www.canada.ca/fr/services/prestations/chercheur.html' },
            { en: 'What to do when someone dies', fr: 'Que faire lors d\'un décès', urlEn: 'https://www.canada.ca/en/services/death.html', urlFr: 'https://www.canada.ca/fr/services/deces.html' },
        ],
        mostRequested: [
            { en: 'Status checker - Dental Plan', fr: 'Vérificateur de l\'état - Régime canadien de soins dentaires', urlEn: 'https://www.canada.ca/en/services/benefits/dental/dental-care-plan/apply.html#check', urlFr: 'https://www.canada.ca/fr/services/prestations/dentaire/regime-soins-dentaires/demande.html#verifier' },
            { en: 'Child and family benefits calculators', fr: 'Calculateur de prestations pour enfants et familles', urlEn: 'https://www.canada.ca/en/revenue-agency/services/child-family-benefits/child-family-benefits-calculator.html', urlFr: 'https://www.canada.ca/fr/agence-revenu/services/prestations-enfants-familles/calculateur-prestations-enfants-familles.html' },
            { en: 'Apply for student loans and grants', fr: 'Faire une demande de bourses et de prêts d\'études', urlEn: 'https://www.canada.ca/en/services/benefits/education/student-aid.html', urlFr: 'https://www.canada.ca/fr/services/prestations/education/aide-etudiants.html' },
            { en: 'Set up or change direct deposit', fr: 'S\'inscrire ou modifier vos informations de dépôt direct', urlEn: 'https://www.canada.ca/en/public-services-procurement/services/payments-to-from-government/direct-deposit.html', urlFr: 'https://www.canada.ca/fr/services-publics-approvisionnement/services/paiements-vers-depuis-gouvernement/depot-direct.html' },
            { en: 'Sign in to a Government of Canada online account', fr: 'Ouvrir une session pour un compte en ligne du gouvernement du Canada', urlEn: 'https://www.canada.ca/en/government/sign-in-online-account.html', urlFr: 'https://www.canada.ca/fr/gouvernement/ouvrir-session-dossier-compte-en-ligne.html' },
            { en: 'Apply for Employment Insurance', fr: 'Présenter une demande d\'assurance-emploi', urlEn: 'https://www.canada.ca/en/services/benefits/ei/ei-regular-benefit.html', urlFr: 'https://www.canada.ca/fr/services/prestations/ae/assurance-emploi-reguliere.html' },
            { en: 'Submit your EI report', fr: 'Soumettre votre déclaration de l\'assurance-emploi', urlEn: 'https://www.canada.ca/en/services/benefits/ei/employment-insurance-reporting.html#Internet-Reporting-Service', urlFr: 'https://www.canada.ca/fr/services/prestations/ae/declarations-assurance-emploi.html#service-declaration-Internet' },
        ]
    },
    {
        id: 'health',
        label: { en: 'Health', fr: 'Santé' },
        title: { en: 'Health', fr: 'Santé' },
        homeLink: { en: 'https://www.canada.ca/en/services/health.html', fr: 'https://www.canada.ca/fr/services/sante.html' },
        items: [
            { en: 'Food and nutrition', fr: 'Aliments et nutrition', urlEn: 'https://www.canada.ca/en/services/health/food-nutrition.html', urlFr: 'https://www.canada.ca/fr/services/sante/aliments-et-nutrition.html' },
            { en: 'Drug and health products', fr: 'Médicaments et produits de santé', urlEn: 'https://www.canada.ca/en/services/health/drug-health-products.html', urlFr: 'https://www.canada.ca/fr/services/sante/medicaments-et-produits-sante.html' },
            { en: 'Vaccines and immunization', fr: 'Vaccins et immunisation', urlEn: 'https://www.canada.ca/en/public-health/services/immunization-vaccines.html', urlFr: 'https://www.canada.ca/fr/sante-publique/services/immunisation-vaccins.html' },
            { en: 'Diseases and conditions', fr: 'Maladies et affections', urlEn: 'https://www.canada.ca/en/public-health/services/diseases.html', urlFr: 'https://www.canada.ca/fr/sante-publique/services/maladies.html' },
            { en: 'Health system and services', fr: 'Système et services de santé', urlEn: 'https://www.canada.ca/en/services/health/health-system-services.html', urlFr: 'https://www.canada.ca/fr/services/sante/systeme-et-services-sante.html' },
            { en: 'Product safety', fr: 'Sécurité des produits', urlEn: 'https://www.canada.ca/en/services/health/product-safety.html', urlFr: 'https://www.canada.ca/fr/services/sante/securite-produits.html' },
            { en: 'Healthy living', fr: 'Vie saine', urlEn: 'https://www.canada.ca/en/services/health/healthy-living.html', urlFr: 'https://www.canada.ca/fr/services/sante/vie-saine.html' },
            { en: 'Health risks and safety', fr: 'Sécurité et risque pour la santé', urlEn: 'https://www.canada.ca/en/services/health/health-risks-safety.html', urlFr: 'https://www.canada.ca/fr/services/sante/securite-et-risque-pour-sante.html' },
            { en: 'Health science, research and data', fr: 'Sciences de la santé, recherche et données', urlEn: 'https://www.canada.ca/en/services/health/science-research-data.html', urlFr: 'https://www.canada.ca/fr/services/sante/science-recherche-et-donnees.html' },
            { en: 'Indigenous health', fr: 'Santé des Autochtones', urlEn: 'https://www.sac-isc.gc.ca/eng/1569861171996/1569861324236', urlFr: 'https://www.sac-isc.gc.ca/fra/1569861171996/1569861324236' },
        ],
        mostRequested: [
            { en: 'Canadian Dental Care Plan', fr: 'Régime canadien de soins dentaires', urlEn: 'https://www.canada.ca/en/services/benefits/dental/dental-care-plan.html', urlFr: 'https://www.canada.ca/fr/services/prestations/dentaire/regime-soins-dentaires.html' },
            { en: 'Recalls and safety alerts', fr: 'Rappels et avis de sécurité', urlEn: 'https://recalls-rappels.canada.ca/en', urlFr: 'https://recalls-rappels.canada.ca/fr' },
            { en: 'Canada\'s food guide', fr: 'Guide alimentaire canadien', urlEn: 'https://food-guide.canada.ca/en/', urlFr: 'https://guide-alimentaire.canada.ca/fr/' },
            { en: 'Autism', fr: 'Autisme', urlEn: 'https://www.canada.ca/en/public-health/services/diseases/autism-spectrum-disorder-asd.html', urlFr: 'https://www.canada.ca/fr/sante-publique/services/maladies/trouble-spectre-autistique-tsa.html' },
        ]
    },
    {
        id: 'taxes',
        label: { en: 'Taxes', fr: 'Impôts' },
        title: { en: 'Taxes', fr: 'Impôts' },
        homeLink: { en: 'https://www.canada.ca/en/services/taxes.html', fr: 'https://www.canada.ca/fr/services/impots.html' },
        items: [
            { en: 'Income tax', fr: 'Impôt sur le revenu', urlEn: 'https://www.canada.ca/en/services/taxes/income-tax.html', urlFr: 'https://www.canada.ca/fr/services/impots/impot-sur-le-revenu.html' },
            { en: 'Payments', fr: 'Paiements', urlEn: 'https://www.canada.ca/en/revenue-agency/services/payments.html', urlFr: 'https://www.canada.ca/fr/agence-revenu/services/paiements.html' },
            { en: 'Tax credits and benefits for individuals', fr: 'Crédits d\'impôt et prestations pour les particuliers', urlEn: 'https://www.canada.ca/en/services/taxes/child-and-family-benefits.html', urlFr: 'https://www.canada.ca/fr/services/impots/prestations-pour-enfants-et-familles.html' },
            { en: 'GST/HST', fr: 'TPS/TVH', urlEn: 'https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses.html', urlFr: 'https://www.canada.ca/fr/agence-revenu/services/impot/entreprises/sujets/tps-tvh-entreprises.html' },
            { en: 'Payroll', fr: 'Retenues sur la paie', urlEn: 'https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/payroll.html', urlFr: 'https://www.canada.ca/fr/agence-revenu/services/impot/entreprises/sujets/retenues-paie.html' },
            { en: 'Business number', fr: 'Numéro d\'entreprise', urlEn: 'https://www.canada.ca/en/services/taxes/business-number.html', urlFr: 'https://www.canada.ca/fr/services/impots/numero-dentreprise.html' },
            { en: 'Charities and giving', fr: 'Organismes de bienfaisance et dons', urlEn: 'https://www.canada.ca/en/services/taxes/charities.html', urlFr: 'https://www.canada.ca/fr/services/impots/bienfaisance.html' },
            { en: 'Savings and pension plans', fr: 'Régimes d\'épargne et de pension', urlEn: 'https://www.canada.ca/en/services/taxes/savings-and-pension-plans.html', urlFr: 'https://www.canada.ca/fr/services/impots/regimes-depargne-et-de-pension.html' },
            { en: 'Excise and specialty taxes', fr: 'Taxes d\'accise et taxes spéciales', urlEn: 'https://www.canada.ca/en/services/taxes/excise-taxes-duties-and-levies.html', urlFr: 'https://www.canada.ca/fr/services/impots/taxes-daccise-droits-et-prelevements.html' },
            { en: 'Scams and fraud', fr: 'Arnaques et fraudes', urlEn: 'https://www.canada.ca/en/revenue-agency/corporate/scams-fraud.html', urlFr: 'https://www.canada.ca/fr/agence-revenu/organisation/arnaques-fraudes.html' },
            { en: 'Support in difficult situations', fr: 'Soutien dans les situations difficiles', urlEn: 'https://www.canada.ca/en/revenue-agency/services/support-difficult-situations.html', urlFr: 'https://www.canada.ca/fr/agence-revenu/services/soutien-situations-difficiles.html' },
            { en: 'Compliance and enforcement', fr: 'Observation et exécution', urlEn: 'https://www.canada.ca/en/revenue-agency/programs/about-canada-revenue-agency-cra/compliance.html', urlFr: 'https://www.canada.ca/fr/agence-revenu/programmes/a-propos-agence-revenu-canada-arc/observation.html' },
            { en: 'CRA Service feedback', fr: 'Rétroaction sur le service de l\'ARC', urlEn: 'https://www.canada.ca/en/revenue-agency/services/make-a-service-complaint.html', urlFr: 'https://www.canada.ca/fr/agence-revenu/services/faire-plainte-liee-service.html' },
        ],
        mostRequested: [
            { en: 'CRA sign in', fr: 'Se connecter à l\'ARC', urlEn: 'https://www.canada.ca/en/revenue-agency/services/e-services/cra-login-services.html', urlFr: 'https://www.canada.ca/fr/agence-revenu/services/services-electroniques/services-ouverture-session-arc.html' },
            { en: 'Ready to file your GST/HST return', fr: 'Prêt à produire votre déclaration de TPS/TVH', urlEn: 'https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/file-gst-hst-return/how-file.html#h_3', urlFr: 'https://www.canada.ca/fr/agence-revenu/services/impot/entreprises/sujets/tps-tvh-entreprises/produire-declaration-tps-tvh/comment-produire-declaration.html#h_3' },
            { en: 'Find benefit payment dates', fr: 'Trouver la date du prochain versement des prestations', urlEn: 'https://www.canada.ca/en/services/benefits/calendar.html', urlFr: 'https://www.canada.ca/fr/services/prestations/calendrier.html' },
            { en: 'Forms and publications', fr: 'Formulaires et publications', urlEn: 'https://www.canada.ca/en/revenue-agency/services/forms-publications.html', urlFr: 'https://www.canada.ca/fr/agence-revenu/services/formulaires-publications.html' },
            { en: 'Make a payment to the CRA', fr: 'Faire un paiement à l\'ARC', urlEn: 'https://www.canada.ca/en/revenue-agency/services/payments/payments-cra.html', urlFr: 'https://www.canada.ca/fr/agence-revenu/services/paiements/paiements-arc.html' },
        ]
    },
    {
        id: 'environment',
        label: { en: 'Environment and natural resources', fr: 'Environnement et ressources naturelles' },
        title: { en: 'Environment and natural resources', fr: 'Environnement' },
        homeLink: { en: 'https://www.canada.ca/en/services/environment.html', fr: 'https://www.canada.ca/fr/services/environnement.html' },
        items: [
            { en: 'Weather and hazards', fr: 'Météo, climat et catastrophes naturelles', urlEn: 'https://www.canada.ca/en/services/environment/weather.html', urlFr: 'https://www.canada.ca/fr/services/environnement/meteo.html' },
            { en: 'Climate change', fr: 'Changements climatiques', urlEn: 'https://www.canada.ca/en/services/environment/climatechange.html', urlFr: 'https://www.canada.ca/fr/services/environnement/changementsclimatiques.html' },
            { en: 'Energy', fr: 'Énergie', urlEn: 'https://www.canada.ca/en/services/environment/energy.html', urlFr: 'https://www.canada.ca/fr/services/environnement/energie.html' },
            { en: 'Natural resources', fr: 'Ressources naturelles', urlEn: 'https://www.canada.ca/en/services/environment/natural-resources.html', urlFr: 'https://www.canada.ca/fr/services/environnement/ressources-naturelles.html' },
            { en: 'Agricultural production tools and data', fr: 'Production agricole : outils et données', urlEn: 'https://agriculture.canada.ca/en/agricultural-production', urlFr: 'https://agriculture.canada.ca/fr/production-agricole' },
            { en: 'Environment and sustainability in agriculture', fr: 'Environnement et durabilité en agriculture', urlEn: 'https://agriculture.canada.ca/en/environment', urlFr: 'https://agriculture.canada.ca/fr/environnement' },
            { en: 'Fisheries', fr: 'Pêches', urlEn: 'https://www.canada.ca/en/services/environment/fisheries.html', urlFr: 'https://www.canada.ca/fr/services/environnement/peches.html' },
            { en: 'Wildlife, plants and species', fr: 'Faune, flore et espèces', urlEn: 'https://www.canada.ca/en/services/environment/wildlife-plants-species.html', urlFr: 'https://www.canada.ca/fr/services/environnement/faune-flore-especes.html' },
            { en: 'Pollution and waste management', fr: 'Pollution et gestion des déchets', urlEn: 'https://www.canada.ca/en/services/environment/pollution-waste-management.html', urlFr: 'https://www.canada.ca/fr/services/environnement/pollution-gestion-dechets.html' },
            { en: 'Environmental conservation and protection', fr: 'Conservation et protection de l\'environnement', urlEn: 'https://www.canada.ca/en/services/environment/conservation.html', urlFr: 'https://www.canada.ca/fr/services/environnement/conservation.html' },
            { en: 'Environment statistics', fr: 'Statistiques sur l\'environnement', urlEn: 'https://www.statcan.gc.ca/en/subjects-start/environment', urlFr: 'https://www.statcan.gc.ca/fr/sujets-debut/environnement' },
            { en: 'Water and the environment', fr: 'L\'eau et l\'environnement', urlEn: 'https://www.canada.ca/en/environment-climate-change/services/water-overview.html', urlFr: 'https://www.canada.ca/fr/environnement-changement-climatique/services/eau-apercu.html' },
        ],
        mostRequested: [
            { en: 'Local weather forecast', fr: 'Prévisions météorologiques locales', urlEn: 'https://weather.gc.ca/canada_e.html', urlFr: 'https://meteo.gc.ca/canada_f.html' },
            { en: 'Fuel-efficient vehicles', fr: 'Véhicules écoénergétiques', urlEn: 'https://natural-resources.canada.ca/energy-efficiency/transportation-energy-efficiency/personal-vehicles/most-fuel-efficient-vehicles', urlFr: 'https://ressources-naturelles.canada.ca/efficacite-energitique/efficacite-energitique-transports/vehicules-personnels/vehicules-plus-ecoenergetiques' },
            { en: 'Home energy efficiency', fr: 'L\'efficacité énergétique pour les maisons', urlEn: 'https://natural-resources.canada.ca/energy-efficiency/home-energy-efficiency/energy-efficiency-homes', urlFr: 'https://ressources-naturelles.canada.ca/efficacite-energetique/efficacite-energetique-maison/maisons' },
            { en: 'Prepare for severe weather', fr: 'Se préparer pour du temps violent', urlEn: 'https://www.canada.ca/en/environment-climate-change/services/seasonal-weather-hazards.html', urlFr: 'https://www.canada.ca/fr/environnement-changement-climatique/services/meteo-saisonniere-dangereuse.html' },
            { en: 'Download WeatherCAN', fr: 'Télécharger MétéoCAN', urlEn: 'https://www.canada.ca/en/environment-climate-change/services/weather-general-tools-resources/weathercan.html', urlFr: 'https://www.canada.ca/fr/environnement-changement-climatique/services/conditions-meteorologiques-ressources-outils-generaux/meteocan.html' },
        ]
    },
    {
        id: 'defence',
        label: { en: 'National security and defence', fr: 'Sécurité nationale et défense' },
        title: { en: 'National security and defence', fr: 'Sécurité nationale et défense' },
        homeLink: { en: 'https://www.canada.ca/en/services/defence.html', fr: 'https://www.canada.ca/fr/services/defense.html' },
        items: [
            { en: 'National security', fr: 'Sécurité nationale', urlEn: 'https://www.canada.ca/en/services/defence/nationalsecurity.html', urlFr: 'https://www.canada.ca/fr/services/defense/securitenationale.html' },
            { en: 'Canadian Armed Forces', fr: 'Forces armées canadiennes', urlEn: 'https://www.canada.ca/en/services/defence/caf.html', urlFr: 'https://www.canada.ca/fr/services/defense/fac.html' },
            { en: 'Jobs in national security and defence', fr: 'Emplois en sécurité nationale et en défense', urlEn: 'https://www.canada.ca/en/services/defence/jobs.html', urlFr: 'https://www.canada.ca/fr/services/defense/emplois.html' },
            { en: 'Services and benefits', fr: 'Services et avantages sociaux', urlEn: 'https://www.canada.ca/en/government/publicservice/benefitsmilitary.html', urlFr: 'https://www.canada.ca/fr/gouvernement/fonctionpublique/avantagesmilitaires.html' },
            { en: 'Cyber security', fr: 'Cybersécurité', urlEn: 'https://www.canada.ca/en/services/defence/cybersecurity.html', urlFr: 'https://www.canada.ca/fr/services/defense/cybersecurite.html' },
            { en: 'Defence equipment purchases and upgrades', fr: 'Achat et mise à niveau d\'équipement de la Défense', urlEn: 'https://www.canada.ca/en/services/defence/defence-equipment-purchases-upgrades.html', urlFr: 'https://www.canada.ca/fr/services/defense/achat-mise-a-niveau-equipement-defense.html' },
            { en: 'Securing the border', fr: 'Sécuriser la frontière', urlEn: 'https://www.canada.ca/en/services/defence/securingborder.html', urlFr: 'https://www.canada.ca/fr/services/defense/securiserfrontiere.html' },
            { en: 'Transportation security', fr: 'Sûreté des transports', urlEn: 'https://tc.canada.ca/en/corporate-services/transportation-security', urlFr: 'https://tc.canada.ca/fr/services-generaux/surete-transports' },
        ],
        mostRequested: [
            { en: 'Jobs in the Forces', fr: 'Emplois dans les Forces', urlEn: 'https://forces.ca/en/careers/', urlFr: 'https://forces.ca/fr/carrieres/' },
            { en: 'Canadian military support to Ukraine', fr: 'Soutien militaire canadien envers l\'Ukraine', urlEn: 'https://www.canada.ca/en/department-national-defence/campaigns/canadian-military-support-to-ukraine.html', urlFr: 'https://www.canada.ca/fr/ministere-defense-nationale/campagnes/soutien-militaire-canadien-envers-lukraine.html' },
            { en: 'Military ranks', fr: 'Grades militaires', urlEn: 'https://www.canada.ca/en/services/defence/caf/military-identity-system/rank-appointment-insignia.html', urlFr: 'https://www.canada.ca/fr/services/defense/fac/systeme-identite-militaire/insignes-grade-fonction.html' },
            { en: 'Defence equipment', fr: 'Équipement de la Défense', urlEn: 'https://www.canada.ca/en/services/defence/caf/equipment.html', urlFr: 'https://www.canada.ca/fr/services/defense/fac/equipement.html' },
            { en: 'Canada\'s Defence policy', fr: 'Politique de défense du Canada', urlEn: 'https://www.canada.ca/en/department-national-defence/corporate/policies-standards/our-north-strong-free-renewed-vision-canada-defence.html', urlFr: 'https://www.canada.ca/fr/ministere-defense-nationale/organisation/politiques-normes/notre-nord-fort-libre-vision-renouvelee-defense-canada.html' },
            { en: 'Join the Cadet Program', fr: 'Joignez-vous aux cadets', urlEn: 'https://www.canada.ca/en/department-national-defence/services/cadets-junior-canadian-rangers/cadets/join-us.html', urlFr: 'https://www.canada.ca/fr/ministere-defense-nationale/services/cadets-rangers-juniors-canadiens/cadets/rejoignez-nous.html' },
        ]
    },
    {
        id: 'culture',
        label: { en: 'Culture, history and sport', fr: 'Culture, histoire et sport' },
        title: { en: 'Culture, history and sport', fr: 'Culture' },
        homeLink: { en: 'https://www.canada.ca/en/services/culture.html', fr: 'https://www.canada.ca/fr/services/culture.html' },
        items: [
            { en: 'Funding - Culture, history and sport', fr: 'Financement - Culture, histoire et sport', urlEn: 'https://www.canada.ca/en/canadian-heritage/services/funding.html', urlFr: 'https://www.canada.ca/fr/patrimoine-canadien/services/financement.html' },
            { en: 'Events, celebrations and commemorations', fr: 'Événements, célébrations et commémorations', urlEn: 'https://www.canada.ca/en/services/culture/events-celebrations-commemorations.html', urlFr: 'https://www.canada.ca/fr/services/culture/evenements-celebrations-commemorations.html' },
            { en: 'Cultural landmarks and attractions', fr: 'Lieux et attraits culturels', urlEn: 'https://www.canada.ca/en/services/culture/cultural-attractions.html', urlFr: 'https://www.canada.ca/fr/services/culture/attraits-culturels.html' },
            { en: 'Canadian identity and society', fr: 'Identité canadienne et société', urlEn: 'https://www.canada.ca/en/services/culture/canadian-identity-society.html', urlFr: 'https://www.canada.ca/fr/services/culture/identite-canadienne-societe.html' },
            { en: 'Sport', fr: 'Sport', urlEn: 'https://www.canada.ca/en/services/culture/sport.html', urlFr: 'https://www.canada.ca/fr/services/culture/sport.html' },
            { en: 'History and heritage', fr: 'Histoire et patrimoine', urlEn: 'https://www.canada.ca/en/services/culture/history-heritage.html', urlFr: 'https://www.canada.ca/fr/services/culture/histoire-patrimoine.html' },
            { en: 'Arts and media', fr: 'Arts et média', urlEn: 'https://www.canada.ca/en/services/culture/arts-media.html', urlFr: 'https://www.canada.ca/fr/services/culture/arts-media.html' },
            { en: 'Youth leadership and cultural program', fr: 'Programmes de leadership et culturels pour les jeunes', urlEn: 'https://www.canada.ca/en/services/culture/cultural-youth-programs.html', urlFr: 'https://www.canada.ca/fr/services/culture/programmes-culturels-jeunes.html' },
            { en: 'Cultural trade and investment', fr: 'Commerce et investissement culturels', urlEn: 'https://www.canada.ca/en/services/culture/cultural-trade-investment.html', urlFr: 'https://www.canada.ca/fr/services/culture/commerce-investissement-culturels.html' },
        ],
        mostRequested: [
            { en: 'Visit the Canadian Virtual War Memorial', fr: 'Visitez le Mémorial virtuel de guerre du Canada', urlEn: 'https://www.veterans.gc.ca/en/remembrance/memorials/canadian-virtual-war-memorial', urlFr: 'https://www.veterans.gc.ca/fr/remembrance/memorials/canadian-virtual-war-memorial' },
            { en: 'Anthems and symbols of Canada', fr: 'Hymnes et symboles du Canada', urlEn: 'https://www.canada.ca/en/services/culture/canadian-identity-society/anthems-symbols.html', urlFr: 'https://www.canada.ca/fr/services/culture/identite-canadienne-societe/hymnes-symboles.html' },
            { en: 'Find a CRTC decision', fr: 'Trouvez une décision du CRTC', urlEn: 'https://crtc.gc.ca/eng/dno.htm', urlFr: 'https://crtc.gc.ca/fra/dno.htm' },
            { en: 'Research your family history', fr: 'Faites des recherches sur votre histoire familiale', urlEn: 'https://library-archives.canada.ca/eng/collection/research-help/genealogy-family-history/Pages/genealogy-family-history.aspx', urlFr: 'https://bibliotheque-archives.canada.ca/fra/collection/aide-recherche/genealogie-histoire-famille/Pages/genealogie-histoire-famille.aspx' },
            { en: 'Search census records', fr: 'Cherchez des documents de recensement', urlEn: 'https://recherche-collection-search.bac-lac.gc.ca/eng/Census/index', urlFr: 'https://recherche-collection-search.bac-lac.gc.ca/fra/recensement/indice' },
            { en: 'Major events in Canada\'s Capital Region', fr: 'Événements majeurs dans la région de la capitale du Canada', urlEn: 'https://www.canada.ca/en/services/culture/events-celebrations-commemorations/experience-canada-capital/events-capital.html', urlFr: 'https://www.canada.ca/fr/services/culture/evenements-celebrations-commemorations/vivez-capitale-canada/evenements-capitale.html' },
        ]
    },
    {
        id: 'policing',
        label: { en: 'Policing, justice and emergencies', fr: 'Services de police, justice et urgences' },
        title: { en: 'Policing, justice and emergencies', fr: 'Services de police' },
        homeLink: { en: 'https://www.canada.ca/en/services/policing.html', fr: 'https://www.canada.ca/fr/services/police.html' },
        items: [
            { en: 'Policing', fr: 'Services de police', urlEn: 'https://www.canada.ca/en/services/policing/police.html', urlFr: 'https://www.canada.ca/fr/services/police/servicespolice.html' },
            { en: 'Justice', fr: 'Justice', urlEn: 'https://www.canada.ca/en/services/policing/justice.html', urlFr: 'https://www.canada.ca/fr/services/police/justice.html' },
            { en: 'Emergencies', fr: 'Urgences', urlEn: 'https://www.canada.ca/en/services/policing/emergencies.html', urlFr: 'https://www.canada.ca/fr/services/police/urgences.html' },
            { en: 'Corrections', fr: 'Services correctionnels', urlEn: 'https://www.canada.ca/en/services/policing/corrections.html', urlFr: 'https://www.canada.ca/fr/services/police/correctionnels.html' },
            { en: 'Parole, record suspension, expungement and clemency', fr: 'Libération conditionnelle, suspension du casier, radiation et clémence', urlEn: 'https://www.canada.ca/en/services/policing/parole.html', urlFr: 'https://www.canada.ca/fr/services/police/liberationconditionnelle.html' },
            { en: 'Victims of crime', fr: 'Victimes d\'actes criminels', urlEn: 'https://www.canada.ca/en/services/policing/victims.html', urlFr: 'https://www.canada.ca/fr/services/police/victimes.html' },
            { en: 'Crime and justice statistics', fr: 'Statistiques sur la criminalité et la justice', urlEn: 'https://www.statcan.gc.ca/en/subjects-start/crime_and_justice', urlFr: 'https://www.statcan.gc.ca/fr/sujets-debut/crime_et_justice' },
        ],
        mostRequested: [
            { en: 'Wildfire Response', fr: 'Interventions lors de feux de forêts', urlEn: 'https://www.canada.ca/en/public-safety-canada/campaigns/wildfires.html', urlFr: 'https://www.canada.ca/fr/securite-publique-canada/campagnes/feux-de-foret.html' },
            { en: 'Apply/Renew a firearms licence', fr: 'Demander ou renouveler un permis d\'arme à feu', urlEn: 'https://rcmp.ca/en/firearms', urlFr: 'https://grc.ca/fr/armes-feu' },
            { en: 'Get a criminal records check', fr: 'Obtenir une attestation de vérification de casier judiciaire', urlEn: 'https://rcmp.ca/en/criminal-records/criminal-record-checks', urlFr: 'https://grc.ca/fr/casiers-judiciaires/verification-casier-judiciaire' },
            { en: 'Apply for a criminal record suspension', fr: 'Demander la suspension d\'un casier judiciaire', urlEn: 'https://www.canada.ca/en/parole-board/services/record-suspensions/official-pbc-application-guide-and-forms.html', urlFr: 'https://www.canada.ca/fr/commission-liberations-conditionnelles/services/suspension-du-casier/guide-et-formulaires-de-demande.html' },
            { en: 'What to do during an emergency', fr: 'Que faire durant une urgence', urlEn: 'https://www.getprepared.gc.ca/cnt/hzd/drng-en.aspx', urlFr: 'https://www.preparez-vous.gc.ca/cnt/hzd/drng-fr.aspx' },
            { en: 'Know the law on impaired driving', fr: 'Connaissez la loi sur la conduite avec facultés affaiblies', urlEn: 'https://www.canada.ca/en/services/policing/police/community-safety-policing/impaired-driving.html', urlFr: 'https://www.canada.ca/fr/services/police/servicespolice/securite-communautaire-police/conduite-facultes-affaiblies.html' },
            { en: 'Help solve a crime', fr: 'Aidez à résoudre un crime', urlEn: 'https://www.canada.ca/en/services/policing/police/help-solve-crime.html', urlFr: 'https://www.canada.ca/fr/services/police/servicespolice/aider-resoudre-un-crime.html' },
        ]
    },
    {
        id: 'transport',
        label: { en: 'Transport and infrastructure', fr: 'Transport et infrastructure' },
        title: { en: 'Transport and infrastructure', fr: 'Transport' },
        homeLink: { en: 'https://www.canada.ca/en/services/transport.html', fr: 'https://www.canada.ca/fr/services/transport.html' },
        items: [
            { en: 'Zero-emission vehicles', fr: 'Véhicules zéro émission', urlEn: 'https://www.canada.ca/en/services/transport/zero-emission-vehicles.html', urlFr: 'https://www.canada.ca/fr/services/transport/vehicules-zero-emission.html' },
            { en: 'Aviation', fr: 'Aviation', urlEn: 'https://tc.canada.ca/en/aviation', urlFr: 'https://tc.canada.ca/fr/aviation' },
            { en: 'Marine transportation', fr: 'Transport maritime', urlEn: 'https://tc.canada.ca/en/marine-transportation', urlFr: 'https://tc.canada.ca/fr/transport-maritime' },
            { en: 'Road transportation', fr: 'Transport routier', urlEn: 'https://tc.canada.ca/en/road-transportation', urlFr: 'https://tc.canada.ca/fr/transport-routier' },
            { en: 'Rail transportation', fr: 'Transport ferroviaire', urlEn: 'https://tc.canada.ca/en/rail-transportation', urlFr: 'https://tc.canada.ca/fr/transport-ferroviaire' },
            { en: 'Dangerous goods', fr: 'Marchandises dangereuses', urlEn: 'https://tc.canada.ca/en/dangerous-goods', urlFr: 'https://tc.canada.ca/fr/marchandises-dangereuses' },
            { en: 'Infrastructure', fr: 'Infrastructures', urlEn: 'https://tc.canada.ca/en/infrastructure', urlFr: 'https://tc.canada.ca/fr/infrastructures' },
        ],
        mostRequested: [
            { en: 'Drone safety', fr: 'Sécurité des drones', urlEn: 'https://tc.canada.ca/en/aviation/drone-safety', urlFr: 'https://tc.canada.ca/fr/aviation/securite-drones' },
            { en: 'What not to bring on a plane', fr: 'Articles interdits à bord d\'un avion', urlEn: 'https://tc.canada.ca/en/aviation/aviation-security/what-you-can-t-bring-plane', urlFr: 'https://tc.canada.ca/fr/aviation/surete-aerienne/ce-que-vous-ne-pouvez-pas-apporter-dans-avion' },
            { en: 'Register your vessel', fr: 'Immatriculer votre bâtiment', urlEn: 'https://tc.canada.ca/en/marine-transportation/vessel-licensing-registration', urlFr: 'https://tc.canada.ca/fr/transport-maritime/permis-immatriculation-batiments' },
            { en: 'Child car seat safety', fr: 'Sécurité des sièges d\'auto pour enfants', urlEn: 'https://tc.canada.ca/en/road-transportation/child-car-seat-safety', urlFr: 'https://tc.canada.ca/fr/transport-routier/securite-sieges-auto-enfants' },
            { en: 'Transporting dangerous goods - Regulations', fr: 'Transporter des marchandises dangereuses - Règlements', urlEn: 'https://tc.canada.ca/en/corporate-services/acts-regulations/list-regulations/transportation-dangerous-goods-regulations', urlFr: 'https://tc.canada.ca/fr/services-generaux/lois-reglements/liste-reglements/reglement-transport-marchandises-dangereuses' },
            { en: 'Canadian Aviation Regulations', fr: 'Règlement de l\'aviation canadien', urlEn: 'https://tc.canada.ca/en/corporate-services/acts-regulations/list-regulations/canadian-aviation-regulations-sor-96-433', urlFr: 'https://tc.canada.ca/fr/services-generaux/lois-reglements/liste-reglements/reglement-aviation-canadien-dors-96-433' },
        ]
    },
    {
        id: 'world',
        label: { en: 'Canada and the world', fr: 'Canada et le monde' },
        title: { en: 'Canada and the world', fr: 'Le Canada et le monde' },
        homeLink: { en: 'https://www.international.gc.ca/world-monde/index.aspx?lang=eng', fr: 'https://www.international.gc.ca/world-monde/index.aspx?lang=fra' },
        items: [
            { en: 'International offices and emergency contacts', fr: 'Bureaux internationaux et contacts d\'urgence', urlEn: 'https://www.international.gc.ca/world-monde/offices-bureaux/index.aspx?lang=eng', urlFr: 'https://www.international.gc.ca/world-monde/offices-bureaux/index.aspx?lang=fra' },
            { en: 'Study, work and travel worldwide', fr: 'Étude, travail et voyage partout dans le monde entier', urlEn: 'https://www.international.gc.ca/world-monde/study_work_travel-etude_travail_voyage/index.aspx?lang=eng', urlFr: 'https://www.international.gc.ca/world-monde/study_work_travel-etude_travail_voyage/index.aspx?lang=fra' },
            { en: 'Information by country and territory', fr: 'Information par pays et territoires', urlEn: 'https://www.international.gc.ca/world-monde/country-pays/index.aspx?lang=eng', urlFr: 'https://www.international.gc.ca/world-monde/country-pays/index.aspx?lang=fra' },
            { en: 'Stories', fr: 'Histoires', urlEn: 'https://www.international.gc.ca/world-monde/stories-histoires/index.aspx?lang=eng', urlFr: 'https://www.international.gc.ca/world-monde/stories-histoires/index.aspx?lang=fra' },
            { en: 'Canada\'s foreign policy and international relations', fr: 'Politique étrangère et relations internationales du Canada', urlEn: 'https://www.international.gc.ca/world-monde/international_relations-relations_internationales/index.aspx?lang=eng', urlFr: 'https://www.international.gc.ca/world-monde/international_relations-relations_internationales/index.aspx?lang=fra' },
            { en: 'Global issues and international assistance', fr: 'Enjeux mondiaux et aide internationale', urlEn: 'https://www.international.gc.ca/world-monde/issues_development-enjeux_developpement/index.aspx?lang=eng', urlFr: 'https://www.international.gc.ca/world-monde/issues_development-enjeux_developpement/index.aspx?lang=fra' },
            { en: 'Canadian funding for international initiatives', fr: 'Financement canadien d\'initiatives internationales', urlEn: 'https://www.international.gc.ca/world-monde/funding-financement/index.aspx?lang=eng', urlFr: 'https://www.international.gc.ca/world-monde/funding-financement/index.aspx?lang=fra' },
            { en: 'International trade and investment', fr: 'Commerce international et investissements', urlEn: 'https://international.canada.ca/en/services/business/trade', urlFr: 'https://international.canada.ca/fr/services/entreprises/commerce' },
        ],
        mostRequested: [
            { en: 'Authenticate a document', fr: 'Authentifier un document', urlEn: 'https://www.international.gc.ca/gac-amc/about-a_propos/services/authentication-authentification/index.aspx?lang=eng', urlFr: 'https://www.international.gc.ca/gac-amc/about-a_propos/services/authentication-authentification/index.aspx?lang=fra' },
            { en: 'Project Browser', fr: 'Banque de projets', urlEn: 'https://w05.international.gc.ca/projectbrowser-banqueprojets/?lang=eng', urlFr: 'https://w05.international.gc.ca/projectbrowser-banqueprojets/?lang=fra' },
            { en: 'Find a Canadian scholarship as an international student', fr: 'Trouver une bourse d\'études canadienne en tant qu\'étudiant international', urlEn: 'https://www.educanada.ca/scholarships-bourses/non_can/index.aspx?lang=eng', urlFr: 'https://www.educanada.ca/scholarships-bourses/non_can/index.aspx?lang=fra' },
            { en: 'International treaties signed by Canada', fr: 'Traités internationaux signés par le Canada', urlEn: 'https://www.treaty-accord.gc.ca/index.aspx?Lang=eng', urlFr: 'https://treaty-accord.gc.ca/index.aspx?lang=fra' },
            { en: 'Find international study or research opportunities in Canada', fr: 'Trouver des occasions d\'étude ou de recherche au Canada', urlEn: 'https://www.educanada.ca/index.aspx?lang=eng', urlFr: 'https://www.educanada.ca/index.aspx?lang=fra' },
            { en: 'Contact an embassy or consulate', fr: 'Communiquer avec une ambassade ou un consulat', urlEn: 'https://travel.gc.ca/assistance/embassies-consulates', urlFr: 'https://voyage.gc.ca/assistance/ambassades-consulats' },
            { en: 'Contact a foreign representative in Canada', fr: 'Communiquer avec un représentant étranger au Canada', urlEn: 'https://www.international.gc.ca/protocol-protocole/reps.aspx?lang=eng', urlFr: 'https://www.international.gc.ca/protocol-protocole/reps.aspx?lang=fra' },
        ]
    },
    {
        id: 'money',
        label: { en: 'Money and finances', fr: 'Argent et finances' },
        title: { en: 'Money and finances', fr: 'Argent et finances' },
        homeLink: { en: 'https://www.canada.ca/en/services/finance.html', fr: 'https://www.canada.ca/fr/services/finance.html' },
        items: [
            { en: 'Managing your money', fr: 'Gérer votre argent', urlEn: 'https://www.canada.ca/en/services/finance/manage.html', urlFr: 'https://www.canada.ca/fr/services/finance/gerer.html' },
            { en: 'Consumer affairs', fr: 'Questions de consommation', urlEn: 'https://www.canada.ca/en/services/finance/consumer-affairs.html', urlFr: 'https://www.canada.ca/fr/services/finance/questions-consommation.html' },
            { en: 'Debt and borrowing', fr: 'Dettes et emprunts', urlEn: 'https://www.canada.ca/en/services/finance/debt.html', urlFr: 'https://www.canada.ca/fr/services/finance/dettes.html' },
            { en: 'Education funding', fr: 'Financement des études', urlEn: 'https://www.canada.ca/en/services/finance/educationfunding.html', urlFr: 'https://www.canada.ca/fr/services/finance/financementetudes.html' },
            { en: 'Pensions and retirement', fr: 'Pensions et retraite', urlEn: 'https://www.canada.ca/en/services/finance/pensions.html', urlFr: 'https://www.canada.ca/fr/services/finance/pensions.html' },
            { en: 'Financial tools and calculators', fr: 'Calculatrices et outils financiers', urlEn: 'https://www.canada.ca/en/services/finance/tools.html', urlFr: 'https://www.canada.ca/fr/services/finance/outils.html' },
            { en: 'Savings and investments', fr: 'Épargne et investissement', urlEn: 'https://www.canada.ca/en/services/finance/savings.html', urlFr: 'https://www.canada.ca/fr/services/finance/epargne.html' },
            { en: 'Taxes', fr: 'Impôts', urlEn: 'https://www.canada.ca/en/services/taxes.html', urlFr: 'https://www.canada.ca/fr/services/impots.html' },
            { en: 'Financial literacy programs', fr: 'Programmes de littératie financière', urlEn: 'https://www.canada.ca/en/financial-consumer-agency/services/financial-literacy-programs.html', urlFr: 'https://www.canada.ca/fr/agence-consommation-matiere-financiere/services/programmes-litteratie-financiere.html' },
            { en: 'Business financing and support', fr: 'Subventions et financement pour les entreprises', urlEn: 'https://innovation.ised-isde.canada.ca/s/?language=en_CA', urlFr: 'https://innovation.ised-isde.canada.ca/innovation/s/?language=fr_CA' },
            { en: 'Protection from frauds and scams', fr: 'Protection contre la fraude et les escroqueries', urlEn: 'https://www.canada.ca/en/services/finance/fraud.html', urlFr: 'https://www.canada.ca/fr/services/finance/fraude.html' },
            { en: 'Public finances', fr: 'Finances publiques', urlEn: 'https://www.canada.ca/en/government/system/finances.html', urlFr: 'https://www.canada.ca/fr/gouvernement/systeme/finances.html' },
            { en: 'Financial and money services regulation', fr: 'Réglementation des services financiers et monétaires', urlEn: 'https://www.canada.ca/en/services/business/permits/federallyregulatedindustrysectors/financialservicesregulation.html', urlFr: 'https://www.canada.ca/fr/services/entreprises/permis/secteursindustriereglementationfederale/regleservicesfinanciers.html' },
            { en: 'Insolvency', fr: 'Insolvabilité', urlEn: 'https://www.canada.ca/en/services/finance/bankruptcy.html', urlFr: 'https://www.canada.ca/fr/services/finance/faillite.html' },
        ],
        mostRequested: [
            { en: 'Canada\'s response to U.S. tariffs', fr: 'Réponse du Canada aux droits de douane américains sur les produits canadiens', urlEn: 'https://www.canada.ca/en/department-finance/programs/international-trade-finance-policy/canadas-response-us-tariffs.html', urlFr: 'https://www.canada.ca/fr/ministere-finances/programmes/politiques-finances-echanges-internationaux/reponse-canada-droits-douane-americains.html' },
            { en: 'Housing', fr: 'Logement', urlEn: 'https://www.canada.ca/en/services/finance/manage/housing.html', urlFr: 'https://www.canada.ca/fr/services/finance/gerer/logements.html' },
            { en: 'Student loans', fr: 'Aide financière aux études', urlEn: 'https://www.canada.ca/en/services/benefits/education/student-aid.html', urlFr: 'https://www.canada.ca/fr/services/prestations/education/aide-etudiants.html' },
            { en: 'Credit report and scores', fr: 'Dossiers et cotes de crédit', urlEn: 'https://www.canada.ca/en/financial-consumer-agency/services/credit-reports-score.html', urlFr: 'https://www.canada.ca/fr/agence-consommation-matiere-financiere/services/dossier-pointage-credit.html' },
            { en: 'Mortgages', fr: 'Hypothèques', urlEn: 'https://www.canada.ca/en/financial-consumer-agency/services/mortgages.html', urlFr: 'https://www.canada.ca/fr/agence-consommation-matiere-financiere/services/hypotheques.html' },
            { en: 'Make a budget', fr: 'Faire un budget', urlEn: 'https://itools-ioutils.fcac-acfc.gc.ca/BP-PB/budget-planner', urlFr: 'https://itools-ioutils.fcac-acfc.gc.ca/BP-PB/planificateur-budgetaire' },
            { en: 'Set up or change direct deposit', fr: 'S\'inscrire ou modifier vos informations de dépôt direct', urlEn: 'https://www.canada.ca/en/public-services-procurement/services/payments-to-from-government/direct-deposit.html', urlFr: 'https://www.canada.ca/fr/services-publics-approvisionnement/services/paiements-vers-depuis-gouvernement/depot-direct.html' },
            { en: 'Find a bankruptcy or insolvency record', fr: 'Trouver un dossier de faillite ou d\'insolvabilité', urlEn: 'https://www.ic.gc.ca/app/scr/bsf-osb/ins/login.html?lang=eng', urlFr: 'https://www.ic.gc.ca/app/scr/bsf-osb/ins/connexion.html?lang=fra' },
        ]
    },
    {
        id: 'science',
        label: { en: 'Science and innovation', fr: 'Science et innovation' },
        title: { en: 'Science and innovation', fr: 'Science' },
        homeLink: { en: 'https://www.canada.ca/en/services/science.html', fr: 'https://www.canada.ca/fr/services/science.html' },
        items: [
            { en: 'Research funding and awards', fr: 'Financement, subventions et prix pour la recherche', urlEn: 'https://www.canada.ca/en/services/science/researchfunding.html', urlFr: 'https://www.canada.ca/fr/services/science/financementrecherche.html' },
            { en: 'R&D and innovation', fr: 'R-D et innovation', urlEn: 'https://www.canada.ca/en/services/science/innovation.html', urlFr: 'https://www.canada.ca/fr/services/science/innovation.html' },
            { en: 'Science subjects', fr: 'Thèmes scientifiques', urlEn: 'https://www.canada.ca/en/services/science/sciencesubjects.html', urlFr: 'https://www.canada.ca/fr/services/science/themesscientifiques.html' },
            { en: 'Health emergency readiness', fr: 'Préparation aux crises sanitaires', urlEn: 'https://ised-isde.canada.ca/site/ised/en/programs-and-initiatives/health-emergency-readiness-canada', urlFr: 'https://ised-isde.canada.ca/site/isde/fr/programmes-initiatives/preparation-aux-crises-sanitaires-canada' },
            { en: 'Research institutes and facilities', fr: 'Instituts et établissements de recherches', urlEn: 'https://www.canada.ca/en/services/science/institutes.html', urlFr: 'https://www.canada.ca/fr/services/science/instituts.html' },
            { en: 'Open data, statistics and archives', fr: 'Données ouvertes, statistiques et archives', urlEn: 'https://www.canada.ca/en/services/science/open-data.html', urlFr: 'https://www.canada.ca/fr/services/science/donnees-ouvertes.html' },
            { en: 'Science education resources', fr: 'Ressources pédagogiques scientifiques', urlEn: 'https://www.canada.ca/en/services/science/educationalresources.html', urlFr: 'https://www.canada.ca/fr/services/science/ressourcespedagogiques.html' },
            { en: 'Intellectual property and copyright', fr: 'Propriété intellectuelle et droit d\'auteur', urlEn: 'https://www.canada.ca/en/services/business/ip.html', urlFr: 'https://www.canada.ca/fr/services/entreprises/pi.html' },
            { en: 'Directory of scientists and research professionals', fr: 'Répertoire des scientifiques et des professionnels de la recherche', urlEn: 'https://www.canada.ca/en/services/science/scientistsdirectory.html', urlFr: 'https://www.canada.ca/fr/services/science/repertoirescientifiques.html' },
            { en: 'Our environment', fr: 'Notre environnement', urlEn: 'https://www.canada.ca/en/services/environment/our-environment.html', urlFr: 'https://www.canada.ca/fr/services/environnement/notre-environnement.html' },
            { en: 'Federal Open Science Repository of Canada', fr: 'Dépôt fédéral de science ouverte du Canada', urlEn: 'https://open-science.canada.ca/home', urlFr: 'https://science-ouverte.canada.ca/accueil' },
        ],
        mostRequested: [
            { en: 'Grants for technological innovation (IRAP)', fr: 'Bourses pour l\'innovation technologique (PARI)', urlEn: 'https://nrc.canada.ca/en/support-technology-innovation/financial-support-technology-innovation-through-nrc-irap', urlFr: 'https://nrc.canada.ca/fr/soutien-linnovation-technologique/soutien-financier-linnovation-technologique-pari-cnrc' },
            { en: 'National building codes', fr: 'Code national du bâtiment', urlEn: 'https://nrc.canada.ca/en/certifications-evaluations-standards/codes-canada/codes-canada-publications', urlFr: 'https://cnrc.canada.ca/fr/certifications-evaluations-normes/codes-canada/publications-codes-canada' },
            { en: 'Federal Science Libraries Network', fr: 'Réseau des bibliothèques scientifiques fédérales', urlEn: 'https://science-libraries.canada.ca/eng/home/', urlFr: 'https://science-libraries.canada.ca/fra/accueil/' },
            { en: 'Check sunrise and sunset times', fr: 'Trouver les heures de levers et de couchers du soleil', urlEn: 'https://nrc.canada.ca/en/research-development/products-services/software-applications/sun-calculator/', urlFr: 'https://cnrc.canada.ca/fr/recherche-developpement/produits-services/logiciels-applications/calculatrice-soleil/' },
            { en: 'Official times across Canada', fr: 'Heures officielles au Canada', urlEn: 'https://nrc.canada.ca/en/web-clock/', urlFr: 'https://cnrc.canada.ca/fr/horloge-web/' },
            { en: 'Live view of northern lights cam', fr: 'Aurores boréales en direct', urlEn: 'https://www.asc-csa.gc.ca/eng/astronomy/northern-lights/auroramax-observatory.asp', urlFr: 'https://www.asc-csa.gc.ca/fra/astronomie/aurores-boreales/observatoire-auroramax.asp' },
        ]
    },
    {
        id: 'life',
        label: { en: 'Manage life events', fr: 'Gérer les événements de la vie' },
        title: { en: 'Manage life events', fr: 'Gérer' },
        homeLink: { en: 'https://www.canada.ca/en/services/life-events.html', fr: 'https://www.canada.ca/fr/services/evenements-vie.html' },
        items: [
            { en: 'Welcoming a child', fr: 'Accueillir un enfant', urlEn: 'https://www.canada.ca/en/services/life-events/child.html', urlFr: 'https://www.canada.ca/fr/services/evenements-vie/enfant.html' },
            { en: 'Learn and plan for your retirement', fr: 'Apprendre et planifier pour votre retraite', urlEn: 'https://www.canada.ca/en/services/life-events/retirement.html', urlFr: 'https://www.canada.ca/fr/services/evenements-vie/retraite.html' },
            { en: 'What to do when someone dies', fr: 'Que faire lors d\'un décès', urlEn: 'https://www.canada.ca/en/services/life-events/death.html', urlFr: 'https://www.canada.ca/fr/services/evenements-vie/deces.html' },
        ],
        mostRequested: [
            { en: 'Sign in to a Government of Canada account', fr: 'Se connecter à un dossier ou un compte du gouvernement du Canada', urlEn: 'https://www.canada.ca/en/government/sign-in-online-account.html', urlFr: 'https://www.canada.ca/fr/gouvernement/ouvrir-session-dossier-compte-en-ligne.html' },
            { en: 'Benefits payments dates', fr: 'Dates de paiement des prestations', urlEn: 'https://www.canada.ca/en/services/benefits/calendar.html', urlFr: 'https://www.canada.ca/fr/services/prestations/calendrier.html' },
            { en: 'Canadian Retirement Income Calculator', fr: 'Calculatrice du revenu de retraite canadienne', urlEn: 'https://www.canada.ca/en/services/benefits/publicpensions/cpp/retirement-income-calculator.html', urlFr: 'https://www.canada.ca/fr/services/prestations/pensionspubliques/rpc/calculatrice-revenu-retraite.html' },
            { en: 'Get a birth certificate', fr: 'Obtenir un certificat de naissance', urlEn: 'https://www.canada.ca/en/services/life-events/child/register-birth.html', urlFr: 'https://www.canada.ca/fr/services/evenements-vie/enfant/enregistrer-naissance.html' },
            { en: 'CPP payment amounts', fr: 'Montants des prestations du RPC', urlEn: 'https://www.canada.ca/en/services/benefits/publicpensions/cpp/payment-amounts.html', urlFr: 'https://www.canada.ca/fr/services/prestations/pensionspubliques/rpc/montants-paiement.html' },
            { en: 'Canada child benefit', fr: 'Allocation canadienne pour enfants', urlEn: 'https://www.canada.ca/en/revenue-agency/services/child-family-benefits/canada-child-benefit-overview.html', urlFr: 'https://www.canada.ca/fr/agence-revenu/services/prestations-enfants-familles/allocation-canadienne-enfants-apercu.html' },
            { en: 'Prepare tax returns for someone who died', fr: 'Faire les impôts d\'une personne décédée', urlEn: 'https://www.canada.ca/en/revenue-agency/services/tax/individuals/life-events/doing-taxes-someone-died.html', urlFr: 'https://www.canada.ca/fr/agence-revenu/services/impot/particuliers/evenements-vie/faire-impots-personne-decedee.html' },
            { en: 'Apply for a SIN', fr: 'Présenter une demande de NAS', urlEn: 'https://www.canada.ca/en/employment-social-development/services/sin.html', urlFr: 'https://www.canada.ca/fr/emploi-developpement-social/services/numero-assurance-sociale.html' },
        ]
    }
];

const GCHeader = ({ lang, onToggleLanguage }) => {
    const [menuOpen, setMenuOpen] = useState(false);
    const [activeMenu, setActiveMenu] = useState('jobs');
    const [keyboardExpandedMenu, setKeyboardExpandedMenu] = useState(null);
    const [isCompactMode, setIsCompactMode] = useState(false);
    const [isMobileAccordion, setIsMobileAccordion] = useState(false);
    const [expandedMobileCategory, setExpandedMobileCategory] = useState(null);
    const [mostRequestedOpen, setMostRequestedOpen] = useState(false);
    
    // Refs
    const hoverTimeoutRef = useRef(null);
    const firstCategoryRef = useRef(null);

    // Get the appropriate URL based on current language
    const getItemUrl = (item) => lang === 'fr' ? item.urlFr : item.urlEn;
    const getHomeLink = (homeLink) => lang === 'fr' ? homeLink.fr : homeLink.en;

    // Check for compact mode
    const checkCompactMode = useCallback(() => {
        setIsCompactMode(window.innerWidth <= 768);
        setIsMobileAccordion(window.innerWidth <= 960);
    }, []);

    // Listen for resize to update compact mode
    useEffect(() => {
        checkCompactMode();
        window.addEventListener('resize', checkCompactMode);
        return () => window.removeEventListener('resize', checkCompactMode);
    }, [checkCompactMode]);

    const toggleMenu = () => {
        const newMenuOpen = !menuOpen;
        setMenuOpen(newMenuOpen);
        if (newMenuOpen) {
            setActiveMenu('jobs');
            setKeyboardExpandedMenu(null);
            setExpandedMobileCategory(null);
            setMostRequestedOpen(false);
            // Focus the first category button when menu opens
            setTimeout(() => {
                if (firstCategoryRef.current) {
                    firstCategoryRef.current.focus();
                }
            }, 50);
        }
    };

    // Handle mobile accordion category toggle
    const toggleMobileCategory = (menuId) => {
        if (expandedMobileCategory === menuId) {
            setExpandedMobileCategory(null);
        } else {
            setExpandedMobileCategory(menuId);
            setMostRequestedOpen(false);
        }
    };

    // Handle hover with 500ms delay
    const handleMouseEnter = (menuId) => {
        hoverTimeoutRef.current = setTimeout(() => {
            setActiveMenu(menuId);
        }, 500);
    };

    const handleMouseLeave = () => {
        if (hoverTimeoutRef.current) {
            clearTimeout(hoverTimeoutRef.current);
        }
    };

    // Handle click - immediate switch
    const handleClick = (menuId) => {
        if (hoverTimeoutRef.current) {
            clearTimeout(hoverTimeoutRef.current);
        }
        setActiveMenu(menuId);
    };

    // --- ACCESSIBILITY FOCUS HANDLER ---
    
    // 1. Intercept "Enter" on Category Buttons
    const handleDesktopCategoryKeyDown = (e, menuId) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault(); 
            e.stopPropagation();
            
            if (keyboardExpandedMenu === menuId) {
                // Collapse if currently open
                setKeyboardExpandedMenu(null);
            } else {
                // Set state to trigger the layout effect
                setActiveMenu(menuId);
                setKeyboardExpandedMenu(menuId);
            }
        } 
        else if (e.key === 'Escape') {
            setMenuOpen(false);
        }
    };

    // 2. FORCE FOCUS immediately after render
    useLayoutEffect(() => {
        if (menuOpen && keyboardExpandedMenu) {
            const targetId = `panel-title-link-${keyboardExpandedMenu}`;
            const targetElement = document.getElementById(targetId);
            
            if (targetElement) {
                targetElement.focus();
            }
        }
    }, [keyboardExpandedMenu, menuOpen, activeMenu]);

    // 3. Return focus to category button on Escape, Left Arrow, or Shift+Tab
    const handleContentKeyDown = (e) => {
        const collapseAndFocus = () => {
            const menuToFocus = activeMenu;
            setKeyboardExpandedMenu(null);
            setTimeout(() => {
                const btn = document.getElementById(`btn-cat-${menuToFocus}`);
                if (btn) btn.focus();
            }, 0);
        };
        
        if (e.key === 'Escape' || e.key === 'ArrowLeft') {
            e.preventDefault();
            e.stopPropagation();
            collapseAndFocus();
            return;
        }
        
        if (e.key === 'Tab' && e.shiftKey) {
            const firstFocusable = document.getElementById(`panel-title-link-${activeMenu}`);
            if (document.activeElement === firstFocusable) {
                e.preventDefault();
                e.stopPropagation();
                collapseAndFocus();
            }
        }
    };

    // Clean up timeout on unmount
    useEffect(() => {
        return () => {
            if (hoverTimeoutRef.current) {
                clearTimeout(hoverTimeoutRef.current);
            }
        };
    }, []);

    const currentMenuData = MENU_DATA.find(m => m.id === activeMenu) || MENU_DATA[0];

    return (
        <header id="wb-bnr" role="banner" className="gc-header">
            <style>{`
                .gc-header {
                    background-color: var(--gc-background);
                    font-family: 'Noto Sans', sans-serif, Arial;
                    flex-shrink: 0;
                }
                
                /* Logo and search row */
                .gc-header-main {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    padding: 10px 30px 15px 55px; /* Left padding 55px */
                    max-width: 1400px;
                    margin: 0 auto;
                }
                
                .gc-brand {
                    margin-top: 30px; 
                }
                
                .gc-brand img { height: 33px; }
                
                /* Search and lang container */
                .gc-search-lang-wrapper {
                    display: flex;
                    flex-direction: column;
                    align-items: flex-end;
                }
                
                .gc-lang-link {
                    color: var(--gc-link);
                    text-decoration: underline;
                    font-size: 16px;
                    border: none;
                    background: none;
                    outline: none;
                    cursor: pointer;
                    font-family: inherit;
                    margin-bottom: 8px;
                    align-self: flex-end;
                }
                
                .gc-lang-link:hover { 
                    text-decoration: underline; 
                    color: var(--gc-link-hover); 
                }
                
                .gc-lang-link:focus-visible {
                    outline: 3px solid #ffbf47 !important;
                    outline-offset: 2px !important;
                }
                
                .gc-search-form {
                    display: flex;
                    align-items: center;
                }
                
                .gc-search-input {
                    padding: 8px 12px;
                    border: 1px solid #ccc;
                    font-size: 16px;
                    width: 320px;
                    height: 40px;
                }

                .gc-search-input:focus-visible {
                    outline: 3px solid #ffbf47 !important;
                    outline-offset: 2px !important;
                }

                .gc-search-input::placeholder {
                    color: #adadad; 
                    opacity: 1;     
                }
                
                .gc-search-btn {
                    background-color: var(--gc-link);
                    border: none;
                    color: white;
                    padding: 10.5px 14px;
                    cursor: pointer;
                }
                
                .gc-search-btn:hover { background-color: var(--gc-text); }
                
                /* Menu bar */
                .gc-menu-bar {
                    border-top: 1px solid #ddd;
                    position: relative;
                }
                
                .gc-menu-bar-inner {
                    max-width: 1400px;
                    margin: 0 auto;
                    padding: 8px 30px;
                    display: flex;
                    justify-content: flex-start;
                    position: relative;
                }
                
                .gc-menu-btn {
                    background: white;
                    border: none;
                    color: var(--gc-link);
                    padding: 15px 25px;
                    font-size: 1.2rem;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    font-family: inherit;
                    font-weight: 400;
                }
                
                .gc-menu-btn:hover, .gc-menu-btn.active { background-color: var(--gc-text); color: white; border-color: var(--gc-text); }
                .gc-menu-btn:focus-visible { outline: 3px solid #ffbf47 !important; outline-offset: 2px !important; }
                
                .gc-menu-chevron {
                    font-size: 0.65rem;
                    transition: transform 0.2s;
                    margin-left: 5px;
                }
                .gc-menu-chevron.open { transform: rotate(180deg); }
                
                /* Mega Menu Panel */
                .gc-mega-menu {
                    display: none;
                    position: absolute;
                    left: 31px; 
                    top: 100%;
                    background: white;
                    z-index: 1000;
                    border-bottom: 4px solid var(--gc-accent);
                    box-shadow: 0 3px 10px rgba(0,0,0,0.2);
                    width: 1300px; 
                }
                
                .gc-mega-menu.open { display: block; }
                
                .gc-mega-menu-inner {
                    display: flex;
                    min-height: 450px;
                }
                
                /* Left sidebar with categories */
                .gc-menu-sidebar {
                    width: 340px;
                    background-color: var(--gc-text);
                    padding: 0;
                    flex-shrink: 0;
                }
                
                .gc-menu-category {
                    display: block;
                    width: 100%;
                    padding: 12px 20px;
                    text-align: left;
                    background: var(--gc-text);
                    border: none;
                    border-left: 4px solid transparent;
                    color: white;
                    font-size: 18px;
                    cursor: pointer;
                    font-family: inherit;
                    line-height: 1.4;
                }
                
                .gc-menu-category:hover {
                    background-color: white;
                    color: var(--gc-text);
                }
                
                .gc-menu-category.active {
                    background-color: white;
                    color: var(--gc-text);
                    border-left: 1px solid var(--gc-text);
                }
                
               .gc-menu-category:focus-visible {
                    outline: 3px solid #ffbf47 !important;
                    outline-offset: 2px !important;
                    background-color: #ffffff !important;
                    color: #333 !important;
                }
                
                /* Right content area */
                .gc-menu-content {
                    width: 860px; 
                    padding: 25px 35px;
                    display: flex;
                    gap: 50px;
                    box-sizing: border-box;
                    background: white;
                }
                
                .gc-menu-links {
                    flex: 1;
                    min-width: 320px; 
                }
                
                .gc-menu-title {
                    font-size: 32px;
                    color: var(--gc-link);
                    margin: 0 0 40px 0;
                    text-decoration: underline;
                    font-weight: bold;
                    text-wrap: nowrap;
                }
                
                .gc-menu-title a {
                    color: var(--gc-link);
                    text-decoration: underline;
                }
                
                .gc-menu-title a:hover { text-decoration: none; }
                
                .gc-menu-links-list {
                    list-style: none;
                    padding: 0;
                    margin: 0;
                }
                
                .gc-menu-links-list li { margin-bottom: 16px; }
                
                .gc-menu-links-list a {
                    color: var(--gc-link);
                    text-decoration: underline;
                    font-size: 18px;
                    line-height: 1.5;
                }
                
                .gc-menu-links-list a:hover { text-decoration: none; }

                /* Most requested section */
                .gc-most-requested {
                    width: 500px; 
                    flex-shrink: 0;
                    padding-left: 35px;
                    padding-top: 80px;
                }
                
                .gc-most-requested h3 {
                    font-size: 20px;
                    font-weight: 700;
                    margin: 85px 0 15px 0;
                    color: #000000;
                }
                
                .gc-most-requested ul {
                    list-style: disc;
                    padding-left: 20px;
                    margin: 0;
                }
                
                .gc-most-requested li { margin-bottom: 8px; }

                .gc-most-requested li::marker {
                    color: #000000;    
                    font-size: 1.5rem;  
                }
                
                .gc-most-requested a {
                    color: var(--gc-link);
                    text-decoration: underline;
                    font-size: 18px;
                    line-height: 2;
                }
                
                .gc-most-requested a:hover { text-decoration: none; }
                
                /* Breadcrumb */
                .gc-breadcrumb {
                    font-size: 16px;
                    background-color: var(--gc-background);
                }
                
                .gc-breadcrumb-inner {
                    max-width: 1400px;
                    margin: 0 auto;
                    padding: 10px 30px;
                    padding-left: 55px; 
                }

                .gc-breadcrumb-list {
                    list-style: none;
                    margin: 0;
                    padding: 0;
                    display: flex;
                    flex-wrap: wrap;
                    align-items: center;
                }

                .gc-breadcrumb-item {
                    display: inline-flex;
                    align-items: center;
                    color: var(--gc-link);
                }

                .gc-breadcrumb-link {
                    color: var(--gc-link);
                    text-decoration: underline;
                }
                
                .gc-breadcrumb-link:hover { 
                    color: var(--gc-link-hover);
                }
                
                .wb-inv {
                    clip: rect(1px, 1px, 1px, 1px);
                    height: 1px;
                    margin: 0;
                    overflow: hidden;
                    position: absolute;
                    width: 1px;
                }
                
                /* Skip link button */
                .skip-link-btn {
                    background: transparent;
                    border: none;
                    cursor: pointer;
                }
                
                .skip-link-btn:focus {
                    clip: auto !important;
                    height: auto !important;
                    width: auto !important;
                    overflow: visible !important;
                    position: absolute !important;
                    top: 0;
                    left: 0;
                    z-index: 9999;
                    background: var(--gc-accent) !important;
                    color: #ffffff !important;
                    padding: 10px 15px;
                    font-size: 1rem;
                    font-weight: bold;
                    text-decoration: underline;
                    outline: 3px solid #ffcc00;
                    outline-offset: 2px;
                }
                
                /* Responsive */
                @media (max-width: 1097px) {
                    .gc-menu-content {
                        flex-direction: column;
                        gap: 30px;
                        width: 100%;
                    }
                    .gc-most-requested {
                        width: 100%;
                        padding-left: 0;
                        padding-top: 20px;
                        border-top: 1px solid #ddd;
                    }
                }
                
                @media (max-width: 960px) {
                    .gc-mega-menu.desktop-menu { display: none !important; }
                    .gc-mega-menu.mobile-menu.open { display: block !important; }
                    
                    .gc-mega-menu {
                        width: 100%;
                        left: 0;
                        max-width: 100vw;
                        box-sizing: border-box;
                    }
                    
                    .gc-mega-menu-inner { 
                        flex-direction: column;
                        min-height: auto;
                        width: 100%;
                    }
                    
                    .gc-menu-sidebar { 
                        width: 100%; 
                        background: var(--gc-text);
                    }
                    
                    .gc-mobile-category {
                        display: flex;
                        align-items: center;
                        width: 100%;
                        padding: 15px 20px;
                        background: var(--gc-text);
                        border: none;
                        border-bottom: 1px solid #555;
                        color: white;
                        font-size: 18px;
                        cursor: pointer;
                        text-align: left;
                        font-family: inherit;
                    }
                    
                    .gc-mobile-category:hover {
                        background: #555;
                    }
                    
                    .gc-mobile-category.expanded {
                        background: white;
                        color: #333;
                        border-bottom: 1px solid #ddd;
                    }
                    
                    .gc-mobile-chevron {
                        margin-right: 10px;
                        font-size: 12px;
                    }
                    
                    .gc-mobile-content {
                        display: none;
                        background: white;
                        padding: 0;
                    }
                    
                    .gc-mobile-content.open {
                        display: block;
                    }
                    
                    .gc-mobile-home-link {
                        display: block;
                        padding: 15px 20px;
                        border: 2px solid #333;
                        margin: 15px 20px;
                        color: var(--gc-link);
                        text-decoration: underline;
                        font-size: 18px;
                    }
                    
                    .gc-mobile-home-link:hover {
                        text-decoration: none;
                    }
                    
                    .gc-mobile-links-list {
                        list-style: none;
                        padding: 0;
                        margin: 0;
                    }
                    
                    .gc-mobile-links-list li {
                        border-bottom: 1px solid #eee;
                    }
                    
                    .gc-mobile-links-list a {
                        display: block;
                        padding: 15px 20px;
                        color: var(--gc-link);
                        text-decoration: underline;
                        font-size: 18px;
                    }
                    
                    .gc-mobile-links-list a:hover {
                        text-decoration: none;
                        background: #f5f5f5;
                    }
                    
                    .gc-mobile-most-requested-toggle {
                        display: flex;
                        align-items: center;
                        width: 100%;
                        padding: 15px 20px;
                        background: #e0e0e0;
                        border: none;
                        color: #333;
                        font-size: 16px;
                        font-weight: bold;
                        cursor: pointer;
                        text-align: left;
                        font-family: inherit;
                    }
                    
                    .gc-mobile-most-requested-toggle:hover {
                        background: #d0d0d0;
                    }
                    
                    .gc-mobile-most-requested-content {
                        display: none;
                        background: white;
                        padding: 0;
                    }
                    
                    .gc-mobile-most-requested-content.open {
                        display: block;
                    }
                    
                    .gc-mobile-most-requested-content ul {
                        list-style: disc;
                        padding: 0;
                        margin: 0;
                        padding-left: 40px;
                    }
                    
                    .gc-mobile-most-requested-content li {
                        margin-bottom: 0;
                        border-bottom: 1px solid #eee;
                        padding: 15px 20px 15px 0;
                    }
                    
                    .gc-mobile-most-requested-content li::marker {
                        color: #333;
                    }
                    
                    .gc-mobile-most-requested-content a {
                        color: var(--gc-link);
                        text-decoration: underline;
                        font-size: 18px;
                    }
                    
                    .gc-mobile-most-requested-content a:hover {
                        text-decoration: none;
                    }
                }
                
                @media (min-width: 961px) {
                    .gc-mega-menu.desktop-menu.open { display: block; }
                    
                    .gc-mega-menu.mobile-menu {
                        display: none !important;
                        border: 0 !important;
                    }
                    
                    .gc-mega-menu.mobile-menu.open {
                        display: none !important;
                        white-space: nowrap !important;
                        border: 0 !important;
                    }
                    
                    .gc-mega-menu.mobile-menu.open:focus-within {
                        display: none !important;
                        background: white;
                        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                        padding: 20px !important;
                        z-index: 1001;
                        max-width: 600px;
                    }
                }
                
                @media (max-width: 991px) and (min-width: 961px) {
                    .gc-mega-menu-inner { 
                        flex-direction: column;
                        min-height: auto;
                    }
                    .gc-menu-sidebar { width: 100%; }
                    .gc-menu-content { 
                        flex-direction: column; 
                        gap: 20px;
                    }
                    .gc-most-requested { 
                        width: 100%;
                        border-left: none;
                        border-top: 1px solid #ddd;
                        padding-left: 0;
                        padding-top: 20px;
                    }
                }
                
                @media (max-width: 768px) {
                    .gc-header-main { 
                        flex-direction: column; 
                        gap: 15px; 
                        align-items: stretch;
                        padding: 10px 20px;
                        padding-left: 45px;
                    }
                    .gc-brand {
                        margin-top: 0; 
                    }
                    .gc-search-lang-wrapper {
                        width: 100%;
                        align-items: flex-end;
                    }
                    .gc-search-form {
                        width: 100%;
                    }
                    .gc-search-input { width: 100%; flex: 1; }
                    .gc-menu-bar-inner { padding: 8px 20px; }
                    .gc-breadcrumb-inner { 
                        padding: 10px 20px;
                        padding-left: 45px;
                    }
                }
                
                @media (max-width: 480px) {
                    .gc-header-main {
                        padding-left: 10px !important;
                        padding-right: 10px !important;
                    }
                    
                    .gc-brand img {
                        max-width: calc(100vw - 20px);
                        height: auto;
                    }

                    .gc-menu-bar-inner {
                        padding-left: 0 !important;
                        padding-right: 0 !important;
                    }
                    
                    .gc-menu-btn {
                        padding-left: 10px !important;
                        padding-right: 15px !important;
                        width: auto !important; 
                        justify-content: flex-start;
                    }

                    .gc-breadcrumb-inner {
                        padding-left: 10px !important;
                        padding-right: 10px !important;
                    }
                }

                @media (max-width: 480px) {
                    .gc-header-main {
                        padding-left: 10px;
                        padding-right: 10px;
                    }
                    .gc-brand img {
                        max-width: calc(100vw - 20px); 
                        height: auto;
                    }
                    .gc-menu-bar-inner {
                        padding-left: 10px;
                        padding-right: 10px;
                    }
                    .gc-menu-btn {
                        padding-left: 15px;
                        padding-right: 15px;
                    }
                    .gc-breadcrumb-inner {
                        padding-left: 25px; 
                    }
                }
                    #wb-bnr a:not(.gc-brand):not(.gc-breadcrumb-link):focus-visible,
                    #wb-bnr button:not(.gc-menu-btn):not(.gc-lang-link):not(.gc-search-btn):focus-visible,
                    #wb-bnr .gc-menu-category:focus-visible,
                    #wb-bnr .gc-most-requested a:focus-visible {
                        outline: 3px solid #ffbf47 !important;
                        outline-offset: 2px !important;
                        background-color: #ffffff !important;
                        color: #333 !important;
                    }

                    #wb-bnr .gc-brand:focus-visible,
                    #wb-bnr .gc-breadcrumb-link:focus-visible,
                    #wb-bnr .gc-lang-link:focus-visible,
                    #wb-bnr .gc-search-btn:focus-visible {
                        outline: 3px solid #ffbf47 !important;
                        outline-offset: 2px !important;
                    }
            `}</style>

            <button 
                type="button"
                className="wb-inv skip-link-btn"
                onClick={(e) => {
                    e.preventDefault();
                    const mainContent = document.getElementById('main-content');
                    if (mainContent) {
                        mainContent.focus();
                        mainContent.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                }}
                onKeyDown={(e) => {
                    if (e.key === ' ' || e.key === 'Enter') {
                        e.preventDefault();
                        const mainContent = document.getElementById('main-content');
                        if (mainContent) {
                            mainContent.focus();
                            mainContent.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }
                    }
                }}
            >
                {lang === 'en' ? 'Skip to main content' : 'Passer au contenu principal'}
            </button>

            {/* Main row - Logo on left, Language + Search on right */}
            <div className="gc-header-main">
                <a 
                    id="alignment-anchor-left"
                    href={lang === 'en' ? 'https://canada.ca/en.html' : 'https://canada.ca/fr.html'} 
                    className="gc-brand"
                >
                    <img 
                        src={lang === 'en' 
                            ? 'https://www.canada.ca/etc/designs/canada/wet-boew/assets/sig-blk-en.svg'
                            : 'https://www.canada.ca/etc/designs/canada/wet-boew/assets/sig-blk-fr.svg'
                        }
                        alt={lang === 'en' ? 'Government of Canada' : 'Gouvernement du Canada'}
                    />
                </a>
                <div id="alignment-anchor-right" className="gc-search-lang-wrapper">
                    <button type="button" className="gc-lang-link" onClick={onToggleLanguage} lang={lang === 'en' ? 'fr' : 'en'}>
                        {isCompactMode 
                            ? (lang === 'en' ? 'FR' : 'EN')
                            : (lang === 'en' ? 'Français' : 'English')
                        }
                    </button>
                    <form 
                        action={lang === 'en' ? 'https://www.canada.ca/en/sr/srb.html' : 'https://www.canada.ca/fr/sr/srb.html'} 
                        method="get" 
                        role="search" 
                        className="gc-search-form"
                    >
                        <label htmlFor="wb-srch-q" className="wb-inv">
                            {lang === 'en' ? 'Search the website' : 'Rechercher sur le site Web'}
                        </label>
                        <input 
                            id="wb-srch-q"
                            className="gc-search-input"
                            name="q"
                            type="search"
                            placeholder={lang === 'en' ? 'Search the website' : 'Rechercher sur le site Web'}
                        />
                        <button type="submit" className="gc-search-btn">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="11" cy="11" r="8"></circle>
                                <path d="m21 21-4.35-4.35"></path>
                            </svg>
                            <span className="wb-inv">{lang === 'en' ? 'Search' : 'Recherche'}</span>
                        </button>
                    </form>
                </div>
            </div>

            {/* Menu Bar - Left aligned */}
            <div className="gc-menu-bar">
                <div className="gc-menu-bar-inner">
                    <button 
                        type="button" 
                        className={`gc-menu-btn ${menuOpen ? 'active' : ''}`}
                        aria-expanded={menuOpen}
                        aria-controls="gc-main-menu"
                        aria-label={lang === 'en' ? 'Main menu. Press Enter to open or close. Use Tab to navigate categories, Enter to expand a category. Press Escape or Left Arrow to return to category list.' : 'Menu principal. Appuyez sur Entrée pour ouvrir ou fermer. Utilisez Tab pour naviguer les catégories, Entrée pour développer une catégorie. Appuyez sur Échap ou Flèche gauche pour revenir à la liste des catégories.'}
                        onClick={toggleMenu}
                    >
                        MENU
                        <span className={`gc-menu-chevron ${menuOpen ? 'open' : ''}`} aria-hidden="true">▼</span>
                    </button>

                    {/* Desktop Mega Menu */}
                    <div id="gc-main-menu" className={`gc-mega-menu desktop-menu ${menuOpen ? 'open' : ''}`}>
                    <div className="gc-mega-menu-inner">
                        <nav className="gc-menu-sidebar" aria-label={lang === 'en' ? 'Menu categories' : 'Catégories du menu'}>
                            {MENU_DATA.map((menu, index) => (
                                <button
                                    key={menu.id}
                                    id={`btn-cat-${menu.id}`}
                                    ref={index === 0 ? firstCategoryRef : null}
                                    className={`gc-menu-category ${activeMenu === menu.id ? 'active' : ''}`}
                                    onMouseEnter={() => handleMouseEnter(menu.id)}
                                    onMouseLeave={handleMouseLeave}
                                    onClick={() => handleClick(menu.id)}
                                    onKeyDown={(e) => handleDesktopCategoryKeyDown(e, menu.id)}
                                    aria-expanded={keyboardExpandedMenu === menu.id}
                                    aria-controls={`menu-content-${menu.id}`}
                                    tabIndex={menuOpen && (!keyboardExpandedMenu || keyboardExpandedMenu === menu.id) ? 0 : -1}
                                >
                                    {menu.label[lang]}
                                </button>
                            ))}
                        </nav>

                        <div 
                            id={`menu-content-${activeMenu}`}
                            className="gc-menu-content"
                            role="region" 
                            aria-label={currentMenuData.title[lang]}
                            onKeyDown={handleContentKeyDown}
                        >
                            <div className="gc-menu-links">
                                <h2 className="gc-menu-title">
                                    <a 
                                        id={`panel-title-link-${currentMenuData.id}`}
                                        href={getHomeLink(currentMenuData.homeLink)} 
                                    >
                                        {currentMenuData.title[lang]}
                                    </a>
                                </h2>
                                <ul className="gc-menu-links-list">
                                    {currentMenuData.items.map((item, idx) => (
                                        <li key={idx}>
                                            <a href={getItemUrl(item)}>{item[lang]}</a>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            {currentMenuData.mostRequested && (
                                <div className="gc-most-requested">
                                    <h3>{lang === 'en' ? 'Most requested' : 'En demande'}</h3>
                                    <ul>
                                        {currentMenuData.mostRequested.map((item, idx) => (
                                            <li key={idx}>
                                                <a href={getItemUrl(item)}>{item[lang]}</a>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    </div>
                    </div>

                    {/* Accordion Menu */}
                    <div id="gc-accordion-menu" className={`gc-mega-menu mobile-menu ${menuOpen ? 'open' : ''}`} aria-label={lang === 'en' ? 'Main navigation menu. Use Tab to navigate between categories, Enter to expand.' : 'Menu de navigation principal. Utilisez Tab pour naviguer entre les catégories, Entrée pour développer.'}>
                        <nav aria-label={lang === 'en' ? 'Menu categories' : 'Catégories du menu'}>
                            {MENU_DATA.map((menu) => {
                                const isExpanded = expandedMobileCategory === menu.id;
                                const menuData = MENU_DATA.find(m => m.id === menu.id);
                                return (
                                    <div key={menu.id} role="none">
                                        <button
                                            id={`accordion-btn-${menu.id}`}
                                            className={`gc-mobile-category ${isExpanded ? 'expanded' : ''}`}
                                            onClick={() => toggleMobileCategory(menu.id)}
                                            aria-expanded={isExpanded}
                                            aria-controls={`accordion-content-${menu.id}`}
                                            tabIndex={menuOpen ? 0 : -1}
                                        >
                                            <span className="gc-mobile-chevron" aria-hidden="true">{isExpanded ? '▼' : '►'}</span>
                                            {menu.label[lang]}
                                        </button>
                                        
                                        {isExpanded && (
                                        <div 
                                            id={`accordion-content-${menu.id}`}
                                            className="gc-mobile-content open"
                                            role="region"
                                            aria-labelledby={`accordion-btn-${menu.id}`}
                                        >
                                            <a 
                                                href={getHomeLink(menuData.homeLink)} 
                                                className="gc-mobile-home-link"
                                                tabIndex={isExpanded && menuOpen ? 0 : -1}
                                            >
                                                {menuData.title[lang]}
                                            </a>
                                            
                                            <ul className="gc-mobile-links-list" role="list">
                                                {menuData.items.map((item, idx) => (
                                                    <li key={idx}>
                                                        <a 
                                                            href={getItemUrl(item)}
                                                            tabIndex={isExpanded && menuOpen ? 0 : -1}
                                                        >
                                                            {item[lang]}
                                                        </a>
                                                    </li>
                                                ))}
                                            </ul>
                                            
                                            {menuData.mostRequested && menuData.mostRequested.length > 0 && (
                                                <>
                                                    <button 
                                                        className="gc-mobile-most-requested-toggle"
                                                        onClick={() => setMostRequestedOpen(!mostRequestedOpen)}
                                                        aria-expanded={mostRequestedOpen}
                                                        aria-controls={`most-requested-${menu.id}`}
                                                        tabIndex={isExpanded && menuOpen ? 0 : -1}
                                                    >
                                                        <span className="gc-mobile-chevron" aria-hidden="true">{mostRequestedOpen ? '▼' : '►'}</span>
                                                        {lang === 'en' ? 'Most requested' : 'En demande'}
                                                    </button>
                                                    <div 
                                                        id={`most-requested-${menu.id}`}
                                                        className={`gc-mobile-most-requested-content ${mostRequestedOpen ? 'open' : ''}`}
                                                        hidden={!mostRequestedOpen}
                                                    >
                                                        <ul role="list">
                                                            {menuData.mostRequested.map((item, idx) => (
                                                                <li key={idx}>
                                                                    <a 
                                                                        href={getItemUrl(item)}
                                                                        tabIndex={isExpanded && mostRequestedOpen && menuOpen ? 0 : -1}
                                                                    >
                                                                        {item[lang]}
                                                                    </a>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                        )}
                                    </div>
                                );
                            })}
                        </nav>
                    </div>
                </div>
            </div>

           {/* Breadcrumb */}
           <nav className="gc-breadcrumb" aria-label={lang === 'en' ? 'You are here' : 'Vous êtes ici'}>
                <div className="gc-breadcrumb-inner">
                    <ol className="gc-breadcrumb-list">
                        {BREADCRUMBS.map((crumb, index) => (
                            <li key={index} className="gc-breadcrumb-item">
                                {crumb.isInternal ? (
                                    <Link 
                                        to={crumb.link[lang]}
                                        className="gc-breadcrumb-link"
                                    >
                                        {crumb.title[lang]}
                                    </Link>
                                ) : (
                                    <a 
                                        href={crumb.link[lang]}
                                        className="gc-breadcrumb-link"
                                    >
                                        {crumb.title[lang]}
                                    </a>
                                )}
                                {index < BREADCRUMBS.length - 1 && (
                                    <span className="gc-breadcrumb-separator" aria-hidden="true" style={{ margin: '0 10px', color: '#555', fontSize: '1.2em' }}>›</span>
                                )}
                            </li>
                        ))}
                    </ol>
                </div>
            </nav>
        </header>
    );
};

export default GCHeader;
