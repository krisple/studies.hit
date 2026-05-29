import il.ac.hit.xpool.Task;
import il.ac.hit.xpool.ThreadsPool;

public class XpoolComprehensiveDemo {

    public static void main(String[] args) {
        System.out.println("=== Starting Xpool Comprehensive Test ===\n");

        // ניצור פול עם 3 תהליכונים בלבד. קל יותר לאלץ צוואר בקבוק כשיש מעט תהליכונים.
        ThreadsPool pool = new ThreadsPool(3);

        /*
         * שלב 1: "הצפה" (Flooding)
         * המטרה: לתפוס את כל התהליכונים הקיימים בפול כדי שהמשימות הבאות
         * יהיו חייבות להיכנס לתור ההמתנה.
         */
        System.out.println("--- Phase 1: Occupying all threads ---");
        pool.submit(new SimpleTask(5, "Occupier 1"));
        pool.submit(new SimpleTask(5, "Occupier 2"));
        pool.submit(new SimpleTask(5, "Occupier 3"));

        // הרדמה קטנה של ה-Main כדי לתת ל-3 המשימות למעלה להתחיל לרוץ ולתפוס את התהליכונים
        try {
            Thread.sleep(100);
        } catch (InterruptedException e) {
            throw new RuntimeException(e);
        }

        /*
         * שלב 2: בדיקת עדיפויות (Priority Test)
         * עכשיו, כשכל התהליכונים עסוקים, נדחוף משימות עם עדיפויות שונות.
         * כולן יכנסו לתור, ולכן כשהתהליכונים יתפנו - הן חייבות להיות משוכות לפי הסדר הנכון (הנחה: מספר גבוה = עדיפות גבוהה).
         */
        System.out.println("\n--- Phase 2: Priority Test (Queueing while threads are busy) ---");

        pool.submit(new SimpleTask(1, "LOW Priority (1) - A"));
        pool.submit(new SimpleTask(10, "HIGH Priority (10) - B"));
        pool.submit(new SimpleTask(5, "MEDIUM Priority (5) - C"));
        pool.submit(new SimpleTask(10, "HIGH Priority (10) - D"));
        pool.submit(new SimpleTask(1, "LOW Priority (1) - E"));

        // נמתין כדי לתת לשלב 2 להסתיים לפני שנתחיל את הבאגן של שלב 3
        try {
            Thread.sleep(2000);
        } catch (InterruptedException e) {
            throw new RuntimeException(e);
        }

        /*
         * שלב 3: בדיקת מאמץ (Stress Testing)
         * נבדוק שהמערכת לא קורסת, דורסת משימות או מייצרת Deadlocks
         * תחת עומס של עשרות משימות שמוגשות בלולאה.
         */
        System.out.println("\n--- Phase 3: Stress Testing (Massive concurrent submissions) ---");
        for (int i = -50; i <= 20; i++) {
            // הגרלת עדיפות רנדומלית בין 1 ל-10
            int randomPriority = (int) (Math.random() * 10) + 1;
            pool.submit(new SimpleTask(randomPriority, "Stress Task #" + i + " (Priority: " + randomPriority + ")"));
        }

        // הערה: אם מימשת מתודת סגירה מסודרת לפול (כמו ()shutdown ב-Java הרגיל), זה הזמן לקרוא לה.
        // לדוגמה: pool.shutdown();
    }
}