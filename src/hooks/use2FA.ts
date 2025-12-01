/**
 * Hook pour gérer la 2FA (TOTP) avec Supabase Auth MFA
 */

import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';

export interface MFAEnrollment {
    id: string;
    qrCode: string;
    secret: string;
    uri: string;
}

export interface BackupCodesResult {
    codes: string[];
    success: boolean;
}

export function use2FA() {
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);

    /**
     * Enroll (activer) la 2FA pour l'utilisateur courant
     * Retourne le QR code et le secret
     */
    const enroll = async (): Promise<MFAEnrollment | null> => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase.auth.mfa.enroll({
                factorType: 'totp',
                friendlyName: 'Nguma Admin 2FA',
            });

            if (error) {
                console.error('2FA enrollment error:', error);
                toast({
                    variant: 'destructive',
                    title: 'Erreur',
                    description: 'Impossible d\'activer la 2FA. Veuillez réessayer.',
                });
                return null;
            }

            return {
                id: data.id,
                qrCode: data.totp.qr_code,
                secret: data.totp.secret,
                uri: data.totp.uri,
            };
        } catch (err) {
            console.error('2FA enrollment exception:', err);
            toast({
                variant: 'destructive',
                title: 'Erreur',
                description: 'Une erreur est survenue.',
            });
            return null;
        } finally {
            setIsLoading(false);
        }
    };

    /**
     * Vérifier un code TOTP pour finaliser l'enrollment
     */
    const verify = async (factorId: string, code: string): Promise<boolean> => {
        setIsLoading(true);
        try {
            const challenge = await supabase.auth.mfa.challenge({ factorId });

            if (challenge.error) {
                console.error('Challenge error:', challenge.error);
                return false;
            }

            const verify = await supabase.auth.mfa.verify({
                factorId,
                challengeId: challenge.data.id,
                code,
            });

            if (verify.error) {
                console.error('Verify error:', verify.error);
                toast({
                    variant: 'destructive',
                    title: 'Code incorrect',
                    description: 'Le code entré est invalide. Vérifiez et réessayez.',
                });
                return false;
            }

            toast({
                title: '✅ 2FA activée !',
                description: 'Votre compte est sécurisé. Un email de confirmation a été envoyé (vérifiez vos spams).',
            });

            return true;
        } catch (err) {
            console.error('Verify exception:', err);
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    /**
     * Désactiver la 2FA
     */
    const unenroll = async (factorId: string): Promise<boolean> => {
        setIsLoading(true);
        try {
            const { error } = await supabase.auth.mfa.unenroll({ factorId });

            if (error) {
                console.error('Unenroll error:', error);
                toast({
                    variant: 'destructive',
                    title: 'Erreur',
                    description: 'Impossible de désactiver la 2FA.',
                });
                return false;
            }

            toast({
                title: '2FA désactivée',
                description: 'La 2FA a été désactivée. Un email de confirmation a été envoyé (vérifiez vos spams).',
            });

            return true;
        } catch (err) {
            console.error('Unenroll exception:', err);
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    /**
     * Lister les facteurs MFA actifs
     */
    const listFactors = async () => {
        try {
            const { data, error } = await supabase.auth.mfa.listFactors();

            if (error) {
                console.error('List factors error:', error);
                return [];
            }

            return data?.totp || [];
        } catch (err) {
            console.error('List factors exception:', err);
            return [];
        }
    };

    /**
     * Vérifier si la 2FA est activée pour l'utilisateur courant
     */
    const is2FAEnabled = async (): Promise<boolean> => {
        const factors = await listFactors();
        return factors.length > 0;
    };

    /**
     * Générer 10 codes de backup pour la récupération 2FA
     * À appeler après la vérification réussie du code TOTP
     */
    const generateBackupCodes = async (): Promise<BackupCodesResult> => {
        setIsLoading(true);
        try {
            // Générer 10 codes aléatoires (8 caractères alphanumériques)
            const codes = Array.from({ length: 10 }, () => {
                const randomString = Math.random().toString(36).substring(2, 10);
                return randomString.toUpperCase();
            });

            // Récupérer l'utilisateur courant
            const { data: { user }, error: userError } = await supabase.auth.getUser();
            if (userError || !user) {
                console.error('Get user error:', userError);
                toast({
                    variant: 'destructive',
                    title: 'Erreur',
                    description: 'Impossible de récupérer les informations utilisateur.',
                });
                return { codes: [], success: false };
            }

            // Supprimer les anciens codes de backup (si existants)
            await supabase
                .from('backup_codes' as any)
                .delete()
                .eq('user_id', user.id);

            // Insérer les nouveaux codes
            const { error: insertError } = await supabase
                .from('backup_codes' as any)
                .insert(
                    codes.map(code => ({
                        user_id: user.id,
                        code: code,
                    }))
                );

            if (insertError) {
                console.error('Insert backup codes error:', insertError);
                toast({
                    variant: 'destructive',
                    title: 'Erreur',
                    description: 'Impossible de générer les codes de backup.',
                });
                return { codes: [], success: false };
            }

            return { codes, success: true };
        } catch (err) {
            console.error('Generate backup codes exception:', err);
            return { codes: [], success: false };
        } finally {
            setIsLoading(false);
        }
    };

    return {
        enroll,
        verify,
        unenroll,
        listFactors,
        is2FAEnabled,
        generateBackupCodes,
        isLoading,
    };
}
