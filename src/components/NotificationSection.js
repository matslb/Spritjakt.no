export const NotificationSection = () => {
    return (<div>
        <h3>Når vil du bli varslet?</h3>
        Du kan endre disse innstillingene når som helst i kontrollpanelet.
        <div className="notificationSection">
            <div>
                <h4>Varsle meg ved...</h4>
                <label><input type="checkbox" name="onAll" /> Alle prisendringer</label><br />
                <label><input type="checkbox" name="onFilters" /> Prisendringer i lagrede filtre</label><br />
                <label><input type="checkbox" name="onFavorites" /> Prisendringer i favoritter</label><br />
            </div>
            <div>
                <h4>Varsle meg på...</h4>
                <label><input type="checkbox" name="byPush" /> Push-varsler (Ikke på iPhone)</label><br />
                <label><input type="checkbox" name="byEmail" /> E-post</label>
            </div>
        </div>
    </div>);
}

export const handleSubmitEvent = (event = null) => {
    const notifications = {
        onAll: event?.target?.onAll.checked ?? false,
        onFilters: event?.target?.onFilters.checked ?? false,
        onFavorites: event?.target?.onFavorites.checked ?? false,
        byPush: event?.target?.byPush.checked ?? false,
        byEmail: event?.target?.byEmail.checked ?? false,
    }
    return notifications;
}