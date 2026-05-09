package il.ac.hit.xpool;

import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/**
 * Unit tests for TaskComparator using JUnit 5.
 */
public class ComparatorTest {

    private TaskComparator comparator;

    @BeforeEach
    public void setUp() {
        comparator = new TaskComparator();
    }

    @Test
    public void testStandardPriorities() {
        verifyDescending(100, 10);
    }

    @Test
    public void testNegativePriorities() {
        verifyDescending(-5, -20);
    }

    @Test
    public void testZeroBoundaries() {
        verifyDescending(5, 0);
        verifyDescending(0, -5);
    }

    @Test
    public void testIntegerExtremeLimits() {
        verifyDescending(Integer.MAX_VALUE, Integer.MIN_VALUE);
        verifyDescending(10, Integer.MIN_VALUE);
        verifyDescending(Integer.MAX_VALUE, -10);
    }

    @Test
    public void testNullComparison() {
        Assertions.assertThrows(XPoolException.class, () -> {
            comparator.compare(null, new SimpleTask(1));
        });
    }

    private void verifyDescending(int highP, int lowP) {
        Task high = new SimpleTask(highP);
        Task low = new SimpleTask(lowP);

        // descending order: high priority comes first, so compare(low, high) > 0
        Assertions.assertTrue(comparator.compare(low, high) > 0, 
            "Expected " + highP + " to rank higher than " + lowP);
        Assertions.assertTrue(comparator.compare(high, low) < 0, 
            "Expected " + highP + " to rank higher than " + lowP);
    }
}
