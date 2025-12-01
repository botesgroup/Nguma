import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { UploadCloud, File, X, Loader2 } from 'lucide-react';

interface FileUploadControlProps {
  value: string; // The current URL of the file
  onSave: (newUrl: string) => void;
  storageBucket: string;
  label: string;
}

export const FileUploadControl: React.FC<FileUploadControlProps> = ({
  value,
  onSave,
  storageBucket,
  label,
}) => {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [file, setFile] = useState<File | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      const selectedFile = event.target.files[0];
      if (selectedFile.type !== 'application/pdf') {
        toast({
          variant: 'destructive',
          title: 'Fichier invalide',
          description: 'Veuillez sélectionner un fichier PDF.',
        });
        return;
      }
      setFile(selectedFile);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setProgress(0);

    const fileName = `${Date.now()}_${file.name}`;
    const filePath = `${fileName}`;

    const { error } = await supabase.storage
      .from(storageBucket)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: 'application/pdf',
      });

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Erreur d\'upload',
        description: error.message,
      });
      setUploading(false);
      return;
    }

    const { data: { publicUrl } } = supabase.storage
      .from(storageBucket)
      .getPublicUrl(filePath);

    if (publicUrl) {
      onSave(publicUrl);
      toast({
        title: '✅ Succès',
        description: 'Le fichier a été téléversé et l\'URL a été sauvegardée.',
      });
    } else {
        toast({
            variant: 'destructive',
            title: 'Erreur',
            description: 'Impossible de récupérer l\'URL publique du fichier.',
        });
    }

    setFile(null);
    setUploading(false);
    setProgress(0);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4">
        <File className="h-5 w-5 text-muted-foreground" />
        {value ? (
          <a
            href={value}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary underline truncate"
          >
            {value.split('/').pop()}
          </a>
        ) : (
          <p className="text-sm text-muted-foreground">Aucun fichier actuellement défini.</p>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Input
          id="pdf-upload"
          type="file"
          accept="application/pdf"
          onChange={handleFileChange}
          className="flex-1"
          disabled={uploading}
        />
        {file && (
            <Button variant="ghost" size="icon" onClick={() => setFile(null)}>
                <X className="h-4 w-4" />
            </Button>
        )}
      </div>

      {file && (
        <Button onClick={handleUpload} disabled={uploading || !file} className="w-full sm:w-auto">
          {uploading ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Téléversement...</>
          ) : (
            <><UploadCloud className="mr-2 h-4 w-4" /> Téléverser et Sauvegarder</>
          )}
        </Button>
      )}

      {uploading && <Progress value={progress} className="w-full" />}
    </div>
  );
};
