<?php

namespace App\Http\Controllers;

use App\Models\Local;
use Illuminate\Support\Facades\Auth;

abstract class Controller
{
    protected function currentUser()
    {
        return Auth::guard('api')->user();
    }

    protected function isSuperadmin(): bool
    {
        return in_array($this->currentUser()?->role, ['superadmin', 'admin'], true);
    }

    protected function ensureSuperadmin(): void
    {
        abort_unless($this->isSuperadmin(), 403, 'No autorizado');
    }

    protected function ensureLocalAccess(Local|int|null $local): void
    {
        if (!$local) {
            return;
        }

        if ($this->isSuperadmin()) {
            return;
        }

        $localId = $local instanceof Local ? $local->id : $local;
        $hasAccess = $this->currentUser()
            ?->locales()
            ->where('locals.id', $localId)
            ->exists();

        abort_unless($hasAccess, 403, 'No autorizado para este local');
    }

    protected function scopedLocalesQuery()
    {
        $query = Local::query();

        if ($this->currentUser() && !$this->isSuperadmin()) {
            $ids = $this->currentUser()->locales()->pluck('locals.id');
            $query->whereIn('id', $ids);
        }

        return $query;
    }
}
