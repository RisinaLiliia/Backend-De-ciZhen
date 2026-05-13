import { Injectable } from '@nestjs/common';

import type { AppRole } from '../users/schemas/user.schema';
import { WorkspacePrivateOverviewService } from './workspace-private-overview.service';
import { WorkspaceProfileService } from './workspace-profile.service';
import type { WorkspaceActionsResponseDto } from './dto/workspace-actions-response.dto';
import { WorkspaceRequestsSupport, type WorkspaceRequestsLocale } from './workspace-requests.support';

@Injectable()
export class WorkspaceActionsService {
  private readonly support = new WorkspaceRequestsSupport();

  constructor(
    private readonly privateOverview: WorkspacePrivateOverviewService,
    private readonly profile: WorkspaceProfileService,
  ) {}

  private buildGuestResponse(locale: WorkspaceRequestsLocale): WorkspaceActionsResponseDto {
    return {
      section: 'actions',
      header: {
        title: locale === 'de' ? 'Profil-Aktivierung' : 'Profile activation',
        subtitle: locale === 'de'
          ? 'Richte dein Arbeitsprofil ein, ohne den aktuellen Markt-Kontext zu verlieren.'
          : 'Set up your workspace profile without losing the current market context.',
      },
      filters: {
        viewerMode: null,
      },
      summary: {
        items: [
          {
            key: 'account',
            label: locale === 'de' ? 'Account' : 'Account',
            value: 0,
            helper: locale === 'de' ? 'Noch nicht erstellt' : 'Not created yet',
            tone: 'attention',
          },
          {
            key: 'customer',
            label: locale === 'de' ? 'Auftraggeber' : 'Customer',
            value: 0,
            helper: locale === 'de' ? 'Profil noch leer' : 'Profile not started',
            tone: 'all',
          },
          {
            key: 'provider',
            label: locale === 'de' ? 'Anbieter' : 'Provider',
            value: 0,
            helper: locale === 'de' ? 'Profil noch leer' : 'Profile not started',
            tone: 'all',
          },
          {
            key: 'activation',
            label: locale === 'de' ? 'Aktivierung' : 'Activation',
            value: 0,
            helper: locale === 'de' ? 'Registrierung erforderlich' : 'Registration required',
            tone: 'attention',
          },
        ],
      },
      decisionPanel: {
        eyebrow: locale === 'de' ? 'Decision Panel' : 'Decision panel',
        totalNeedsAction: 3,
        title: locale === 'de' ? 'Erste Schritte vorbereiten' : 'Prepare first steps',
        text: locale === 'de'
          ? 'Erstelle deinen Account und entscheide dann, ob du als Auftraggeber oder Anbieter startest.'
          : 'Create your account and then decide whether you want to start as a customer or provider.',
        primaryAction: {
          label: locale === 'de' ? 'Account erstellen' : 'Create account',
          href: '/workspace?section=actions&viewerMode=provider',
          targetFilter: 'setup',
        },
        queueTitle: locale === 'de' ? 'Action Queue' : 'Action queue',
        queue: [
          {
            actionId: 'create_account',
            title: locale === 'de' ? 'Account registrieren' : 'Register account',
            actionType: 'create_account',
            actionLabel: locale === 'de' ? 'Grundlage für alle Modi' : 'Required for all modes',
            actionPriority: 95,
            actionPriorityLevel: 'high',
            actionReason: locale === 'de'
              ? 'Ohne Account kann kein Workspace-Profil gespeichert werden.'
              : 'Without an account the workspace profile cannot be saved.',
            href: '/workspace?section=actions&viewerMode=provider',
          },
          {
            actionId: 'pick_city',
            title: locale === 'de' ? 'Stadt und Kontext setzen' : 'Set city and context',
            actionType: 'create_account',
            actionLabel: locale === 'de' ? 'Für passende Markt-Signale' : 'For relevant market signals',
            actionPriority: 70,
            actionPriorityLevel: 'medium',
            actionReason: locale === 'de'
              ? 'Die Stadt bestimmt später den sichtbaren Markt.'
              : 'The city determines the visible market later.',
            href: '/workspace?section=actions&viewerMode=provider',
          },
          {
            actionId: 'choose_mode',
            title: locale === 'de' ? 'Startmodus wählen' : 'Choose starting mode',
            actionType: 'create_account',
            actionLabel: locale === 'de' ? 'Auftraggeber oder Anbieter' : 'Customer or provider',
            actionPriority: 55,
            actionPriorityLevel: 'low',
            actionReason: locale === 'de'
              ? 'Beide Perspektiven bleiben später im selben Workspace erhalten.'
              : 'Both perspectives remain available later in the same workspace.',
            href: '/workspace?section=actions&viewerMode=provider',
          },
        ],
        emptyText: locale === 'de'
          ? 'Der Arbeitsbereich ist bereit für die Registrierung.'
          : 'The workspace is ready for registration.',
        overviewEyebrow: locale === 'de' ? 'Readiness' : 'Readiness',
        overview: [
          { key: 'account', label: locale === 'de' ? 'Account' : 'Account', value: '0%' },
          { key: 'customer', label: locale === 'de' ? 'Auftraggeber' : 'Customer', value: '0%' },
          { key: 'provider', label: locale === 'de' ? 'Anbieter' : 'Provider', value: '0%' },
        ],
      },
    };
  }

  async getActionsRail(
    userId?: string | null,
    role?: AppRole | null,
    acceptLanguage?: string | null,
  ): Promise<WorkspaceActionsResponseDto> {
    const locale = this.support.resolveWorkspaceLocale(acceptLanguage);
    const uid = String(userId ?? '').trim();
    if (!uid || !role) {
      return this.buildGuestResponse(locale);
    }

    const [overview, profile] = await Promise.all([
      this.privateOverview.getPrivateOverview(uid, role, '30d'),
      this.profile.getProfile(uid),
    ]);

    const providerReady = overview.profiles.providerCompleteness;
    const customerReady = overview.profiles.clientCompleteness;
    const accountReady = profile.common.email?.trim() ? 100 : 0;
    const activationReady = profile.provider.status === 'active' && !profile.provider.isBlocked ? 100 : 0;

    const providerHref = '/workspace?section=actions&viewerMode=provider';
    const customerHref = '/workspace?section=actions&viewerMode=customer';

    const queue: WorkspaceActionsResponseDto['decisionPanel']['queue'] = [];
    if (!profile.common.avatarUrl) {
      queue.push({
        actionId: 'provider_photo',
        title: locale === 'de' ? 'Profilfoto hinzufügen' : 'Add profile photo',
        actionType: 'complete_profile',
        actionLabel: locale === 'de' ? 'Für mehr Vertrauen im Markt' : 'For stronger market trust',
        actionPriority: 95,
        actionPriorityLevel: 'high',
        actionReason: locale === 'de'
          ? 'Ohne Foto wirkt das Profil unvollständig.'
          : 'Without a photo the profile feels incomplete.',
        href: providerHref,
      });
    }
    if (providerReady < 100 && !(profile.provider.serviceKeys?.length ?? 0)) {
      queue.push({
        actionId: 'provider_service',
        title: locale === 'de' ? 'Leistung auswählen' : 'Select service',
        actionType: 'complete_profile',
        actionLabel: locale === 'de' ? 'Für passende Markt-Signale' : 'For relevant market signals',
        actionPriority: 90,
        actionPriorityLevel: 'high',
        actionReason: locale === 'de'
          ? 'Ohne Leistung kann das Anbieterprofil nicht sauber gerankt werden.'
          : 'Without a service the provider profile cannot be ranked properly.',
        href: providerHref,
      });
    }
    if (providerReady < 100 && !(typeof profile.provider.basePrice === 'number' && profile.provider.basePrice > 0)) {
      queue.push({
        actionId: 'provider_price',
        title: locale === 'de' ? 'Basispreis setzen' : 'Set base price',
        actionType: 'complete_profile',
        actionLabel: locale === 'de' ? 'Für klare Erwartung' : 'For clear expectations',
        actionPriority: 75,
        actionPriorityLevel: 'medium',
        actionReason: locale === 'de'
          ? 'Preisangaben helfen bei Sichtbarkeit und Einordnung.'
          : 'Pricing improves visibility and qualification.',
        href: providerHref,
      });
    }
    if (customerReady < 100 && !profile.customer.bio?.trim()) {
      queue.push({
        actionId: 'customer_bio',
        title: locale === 'de' ? 'Auftraggeber-Profil ergänzen' : 'Complete customer profile',
        actionType: 'complete_profile',
        actionLabel: locale === 'de' ? 'Kontext für Anfragen' : 'Context for requests',
        actionPriority: 60,
        actionPriorityLevel: 'medium',
        actionReason: locale === 'de'
          ? 'Ein kurzes Profil schafft Vertrauen bei Anbietern.'
          : 'A short profile builds trust with providers.',
        href: customerHref,
      });
    }
    if (activationReady === 0) {
      queue.push({
        actionId: 'activate_provider',
        title: locale === 'de' ? 'Anbieterprofil aktivieren' : 'Activate provider profile',
        actionType: 'activate_profile',
        actionLabel: locale === 'de' ? 'Bereit für den Markt' : 'Ready for the market',
        actionPriority: 55,
        actionPriorityLevel: 'low',
        actionReason: locale === 'de'
          ? 'Sobald das Profil vollständig ist, kann es aktiv geschaltet werden.'
          : 'Once the profile is complete it can become active.',
        href: providerHref,
      });
    }

    const totalNeedsAction = queue.length;
    const activeMode = overview.preferredRole === 'provider' ? 'provider' : 'customer';

    return {
      section: 'actions',
      header: {
        title: locale === 'de' ? 'Profil-Aktivierung' : 'Profile activation',
        subtitle: locale === 'de'
          ? 'Backend-owned readiness and next steps for workspace activation.'
          : 'Backend-owned readiness and next steps for workspace activation.',
      },
      filters: {
        viewerMode: activeMode,
      },
      summary: {
        items: [
          {
            key: 'account',
            label: locale === 'de' ? 'Account' : 'Account',
            value: accountReady,
            helper: locale === 'de' ? 'Grunddaten vorhanden' : 'Base identity ready',
            tone: accountReady === 100 ? 'completed' : 'attention',
          },
          {
            key: 'customer',
            label: locale === 'de' ? 'Auftraggeber' : 'Customer',
            value: customerReady,
            helper: locale === 'de' ? 'Kundenprofil' : 'Customer profile',
            tone: customerReady >= 80 ? 'execution' : 'attention',
          },
          {
            key: 'provider',
            label: locale === 'de' ? 'Anbieter' : 'Provider',
            value: providerReady,
            helper: locale === 'de' ? 'Anbieterprofil' : 'Provider profile',
            tone: providerReady >= 80 ? 'execution' : 'attention',
          },
          {
            key: 'activation',
            label: locale === 'de' ? 'Aktivierung' : 'Activation',
            value: activationReady,
            helper: locale === 'de' ? 'Marktbereit' : 'Market ready',
            tone: activationReady === 100 ? 'completed' : 'all',
          },
        ],
      },
      decisionPanel: {
        eyebrow: locale === 'de' ? 'Decision Panel' : 'Decision panel',
        totalNeedsAction,
        title: totalNeedsAction > 0
          ? (locale === 'de' ? 'Nächste Aktivierungen' : 'Next activations')
          : (locale === 'de' ? 'Workspace ist bereit' : 'Workspace is ready'),
        text: totalNeedsAction > 0
          ? (
            locale === 'de'
              ? `${queue.length} Schritte sind offen, um Profil und Aktivierung sauber abzuschließen.`
              : `${queue.length} steps remain to complete profile and activation cleanly.`
          )
          : (locale === 'de'
            ? 'Beide Perspektiven sind einsatzbereit.'
            : 'Both perspectives are ready to use.'),
        primaryAction: {
          label: locale === 'de' ? 'Profil weiterführen' : 'Continue profile',
          href: activeMode === 'provider' ? providerHref : customerHref,
          targetFilter: 'setup',
        },
        queueTitle: locale === 'de' ? 'Action Queue' : 'Action queue',
        queue,
        emptyText: locale === 'de'
          ? 'Der aktuelle Arbeitsbereich ist vollständig vorbereitet.'
          : 'The current workspace is fully prepared.',
        overviewEyebrow: locale === 'de' ? 'Readiness' : 'Readiness',
        overview: [
          {
            key: 'account',
            label: locale === 'de' ? 'Account' : 'Account',
            value: `${accountReady}%`,
          },
          {
            key: 'customer',
            label: locale === 'de' ? 'Auftraggeber' : 'Customer',
            value: `${customerReady}%`,
          },
          {
            key: 'provider',
            label: locale === 'de' ? 'Anbieter' : 'Provider',
            value: `${providerReady}%`,
          },
        ],
      },
    };
  }
}
