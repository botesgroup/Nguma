import { supabase } from "@/integrations/supabase/client";

const BUCKET_NAME = 'chat-attachments';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

// Types autorisés
const ALLOWED_FILE_TYPES = [
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/gif',
    'image/webp',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'text/plain'
];

/**
 * Upload un fichier vers Supabase Storage et enregistre dans chat_attachments
 * @param file Fichier à uploader
 * @param messageId ID du message auquel attacher le fichier
 * @returns URL publique du fichier uploadé
 */
export const uploadChatFile = async (file: File, messageId: string): Promise<string> => {
    // Validation de la taille
    if (file.size > MAX_FILE_SIZE) {
        throw new Error(`Fichier trop volumineux. Taille maximale: ${MAX_FILE_SIZE / 1024 / 1024} MB`);
    }

    // Validation du type
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
        throw new Error(`Type de fichier non autorisé. Types acceptés: images, PDF, documents Office, texte`);
    }

    try {
        // Créer un nom de fichier unique
        const fileExt = file.name.split('.').pop();
        const fileName = `${messageId}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

        // Upload vers Supabase Storage
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(fileName, file, {
                cacheControl: '3600',
                upsert: false
            });

        if (uploadError) {
            console.error('Upload error:', uploadError);
            throw new Error(`Erreur lors de l'upload: ${uploadError.message}`);
        }

        // Obtenir l'URL publique
        const { data: urlData } = supabase.storage
            .from(BUCKET_NAME)
            .getPublicUrl(fileName);

        if (!urlData?.publicUrl) {
            throw new Error('Impossible d\'obtenir l\'URL du fichier');
        }

        // Enregistrer dans la base de données
        const { error: dbError } = await supabase
            .from('chat_attachments')
            .insert({
                message_id: messageId,
                file_url: urlData.publicUrl,
                file_name: file.name,
                file_type: file.type,
                file_size: file.size
            });

        if (dbError) {
            // Si erreur DB, supprimer le fichier uploadé
            await supabase.storage.from(BUCKET_NAME).remove([fileName]);
            throw new Error(`Erreur lors de l'enregistrement: ${dbError.message}`);
        }

        return urlData.publicUrl;
    } catch (error) {
        console.error('Error in uploadChatFile:', error);
        throw error;
    }
};

/**
 * Récupère tous les fichiers attachés à un message
 * @param messageId ID du message
 * @returns Liste des attachments
 */
export const getMessageAttachments = async (messageId: string) => {
    const { data, error } = await supabase
        .from('chat_attachments')
        .select('*')
        .eq('message_id', messageId)
        .order('created_at', { ascending: true });

    if (error) {
        console.error('Error fetching attachments:', error);
        throw new Error(error.message);
    }

    return data || [];
};

/**
 * Supprime un fichier attaché (et le fichier du storage)
 * @param attachmentId ID de l'attachment
 */
export const deleteAttachment = async (attachmentId: string) => {
    // Récupérer l'attachment pour obtenir l'URL
    const { data: attachment, error: fetchError } = await supabase
        .from('chat_attachments')
        .select('file_url')
        .eq('id', attachmentId)
        .single();

    if (fetchError || !attachment) {
        throw new Error('Attachment non trouvé');
    }

    // Extraire le chemin du fichier depuis l'URL
    const url = new URL(attachment.file_url);
    const pathParts = url.pathname.split(`/${BUCKET_NAME}/`);
    const filePath = pathParts[1];

    // Supprimer de la DB
    const { error: dbError } = await supabase
        .from('chat_attachments')
        .delete()
        .eq('id', attachmentId);

    if (dbError) {
        throw new Error(dbError.message);
    }

    // Supprimer du storage
    if (filePath) {
        await supabase.storage.from(BUCKET_NAME).remove([filePath]);
    }
};

/**
 * Initialise le bucket storage s'il n'existe pas
 * Cette fonction doit être appelée une fois au setup de l'application
 */
export const initializeChatStorageBucket = async () => {
    try {
        // Vérifier si le bucket existe
        const { data: buckets } = await supabase.storage.listBuckets();
        const bucketExists = buckets?.some(b => b.name === BUCKET_NAME);

        if (!bucketExists) {
            // Créer le bucket
            const { error: createError } = await supabase.storage.createBucket(BUCKET_NAME, {
                public: true,
                fileSizeLimit: MAX_FILE_SIZE,
                allowedMimeTypes: ALLOWED_FILE_TYPES
            });

            if (createError) {
                throw createError;
            }
        }
    } catch (error) {
        console.error('Error initializing storage bucket:', error);
        // Ne pas throw l'erreur car le bucket peut déjà exister
    }
};

/**
 * Formate la taille d'un fichier en format lisible
 * @param bytes Taille en bytes
 * @returns Taille formatée (ex: "2.5 MB")
 */
export const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
};

/**
 * Vérifie si un fichier est une image
 * @param fileType Type MIME du fichier
 * @returns true si c'est une image
 */
export const isImageFile = (fileType: string): boolean => {
    return fileType.startsWith('image/');
};
